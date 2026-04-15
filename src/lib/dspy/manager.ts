import { and, eq, ne } from 'drizzle-orm';
import z from 'zod';
import db from '@/lib/db';
import { dspyFunctions } from '@/lib/db/schema';
import {
  DspyFunctionDefinition,
  DspyFunctionRecord,
  dspyFormatterTypeSchema,
  dspyPersistedFunctionSchema,
} from './types';
import {
  formatMorphologyMatrixMarkdown,
  MorphologyMatrixOutput,
} from './formatters/morphologyMatrix';

type JsonSchema = Record<string, unknown>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const jsonSchemaToZod = (
  schema: unknown,
  path = 'schema',
): z.ZodTypeAny => {
  if (!isObject(schema)) {
    throw new Error(`Invalid JSON schema at ${path}: expected object.`);
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const enumValues = schema.enum.filter((value) => typeof value === 'string');
    if (enumValues.length === schema.enum.length) {
      return z.enum(enumValues as [string, ...string[]]);
    }
  }

  const schemaType = schema.type;

  if (schemaType === 'string') return z.string();
  if (schemaType === 'number') return z.number();
  if (schemaType === 'integer') return z.number().int();
  if (schemaType === 'boolean') return z.boolean();
  if (schemaType === 'null') return z.null();

  if (schemaType === 'array') {
    const items = jsonSchemaToZod((schema as JsonSchema).items, `${path}.items`);
    return z.array(items);
  }

  if (schemaType === 'object' || schema.properties) {
    const properties = isObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required)
      ? new Set(schema.required.filter((value) => typeof value === 'string'))
      : new Set<string>();

    const shape: Record<string, z.ZodTypeAny> = {};
    Object.entries(properties).forEach(([key, value]) => {
      const fieldSchema = jsonSchemaToZod(value, `${path}.properties.${key}`);
      shape[key] = required.has(key) ? fieldSchema : fieldSchema.optional();
    });

    return z.object(shape);
  }

  return z.unknown();
};

const templateInputRegex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

const compilePromptTemplate = (template: string) => {
  return (input: unknown) =>
    template.replace(templateInputRegex, (_, key: string) => {
      if (!isObject(input) || !(key in input)) return '';
      const value = input[key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') return value;
      return JSON.stringify(value);
    });
};

const compileFormatter = (formatterType: z.infer<typeof dspyFormatterTypeSchema>) => {
  if (formatterType === 'morphology_matrix') {
    return (output: unknown) =>
      formatMorphologyMatrixMarkdown(output as MorphologyMatrixOutput);
  }

  return (output: unknown) => `\`\`\`json\n${JSON.stringify(output, null, 2)}\n\`\`\``;
};

class DspyManager {
  static async listPersistedFunctions(): Promise<DspyFunctionRecord[]> {
    const rows = await db.select().from(dspyFunctions).execute();
    return rows.map((row) => dspyPersistedFunctionSchema.parse(row));
  }

  static async createPersistedFunction(
    input: z.infer<typeof dspyPersistedFunctionSchema>,
  ): Promise<DspyFunctionRecord> {
    const parsed = dspyPersistedFunctionSchema.parse(input);

    const existing = await db
      .select({ id: dspyFunctions.id })
      .from(dspyFunctions)
      .where(eq(dspyFunctions.name, parsed.name))
      .limit(1)
      .execute();

    if (existing.length > 0) {
      throw new Error(`DSPy function "${parsed.name}" already exists.`);
    }

    await db.insert(dspyFunctions).values(parsed).execute();
    return parsed;
  }

  static async updatePersistedFunction(
    id: string,
    patch: Partial<z.infer<typeof dspyPersistedFunctionSchema>>,
  ): Promise<DspyFunctionRecord> {
    const existing = await db
      .select()
      .from(dspyFunctions)
      .where(eq(dspyFunctions.id, id))
      .limit(1)
      .execute();

    if (existing.length === 0) {
      throw new Error(`DSPy function "${id}" was not found.`);
    }

    const merged = dspyPersistedFunctionSchema.parse({
      ...existing[0],
      ...patch,
      id: existing[0].id,
      createdAt: existing[0].createdAt,
      updatedAt: new Date().toISOString(),
    });

    if (merged.name !== existing[0].name) {
      const duplicate = await db
        .select({ id: dspyFunctions.id })
        .from(dspyFunctions)
        .where(
          and(eq(dspyFunctions.name, merged.name), ne(dspyFunctions.id, id)),
        )
        .limit(1)
        .execute();

      if (duplicate.length > 0) {
        throw new Error(`DSPy function "${merged.name}" already exists.`);
      }
    }

    await db
      .update(dspyFunctions)
      .set({
        ...merged,
      })
      .where(eq(dspyFunctions.id, id))
      .execute();

    return merged;
  }

  static async deletePersistedFunction(id: string): Promise<void> {
    const existing = await db
      .select({ id: dspyFunctions.id })
      .from(dspyFunctions)
      .where(eq(dspyFunctions.id, id))
      .limit(1)
      .execute();

    if (existing.length === 0) {
      throw new Error(`DSPy function "${id}" was not found.`);
    }

    await db.delete(dspyFunctions).where(eq(dspyFunctions.id, id)).execute();
  }

  static compileDefinition(
    record: DspyFunctionRecord,
  ): DspyFunctionDefinition<z.ZodTypeAny, z.ZodTypeAny> {
    const inputSchema = jsonSchemaToZod(record.inputSchemaJson as JsonSchema);
    const outputSchema = jsonSchemaToZod(record.outputSchemaJson as JsonSchema);

    return {
      name: record.name,
      description: record.description,
      category: record.category,
      inputSchema,
      outputSchema,
      moduleConfig: {
        moduleType: record.moduleType,
        instructions: record.instructions,
        buildUserPrompt: compilePromptTemplate(record.userPromptTemplate),
      },
      formatter: compileFormatter(record.formatterType),
      safety: record.safetyJson ?? undefined,
    };
  }
}

export default DspyManager;
