import DspyFunctionRegistry from '@/lib/dspy/registry';
import DspyManager from '@/lib/dspy/manager';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async () => {
  try {
    await DspyFunctionRegistry.hydrateFromDb();

    const persisted = await DspyManager.listPersistedFunctions();
    const persistedNames = new Set(persisted.map((fn) => fn.name));
    const builtIns = DspyFunctionRegistry.listDefinitions()
      .filter((fn) => !persistedNames.has(fn.name))
      .map((fn) => ({
        id: `builtin:${fn.name}`,
        name: fn.name,
        description: fn.description,
        category: fn.category,
        inputSchemaJson: z.toJSONSchema(fn.inputSchema),
        outputSchemaJson: z.toJSONSchema(fn.outputSchema),
        moduleType: fn.moduleConfig.moduleType,
        instructions: fn.moduleConfig.instructions,
        userPromptTemplate: '',
        formatterType: 'json',
        safetyJson: fn.safety || {},
        createdAt: '',
        updatedAt: '',
        isBuiltin: true,
      }));

    return Response.json({
      functions: [
        ...persisted.map((fn) => ({
          ...fn,
          isBuiltin: false,
        })),
        ...builtIns,
      ],
    });
  } catch (err: any) {
    console.error(`Failed to list DSPy functions: ${err?.message || err}`);
    return Response.json(
      {
        message: err?.message || 'Failed to list DSPy functions',
      },
      { status: 500 },
    );
  }
};

const createFunctionSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  inputSchemaJson: z.record(z.string(), z.unknown()),
  outputSchemaJson: z.record(z.string(), z.unknown()),
  moduleType: z.enum(['ChainOfThought', 'PredictModule']),
  instructions: z.string().min(1),
  userPromptTemplate: z.string().min(1),
  formatterType: z.enum(['json', 'morphology_matrix']),
  safetyJson: z.record(z.string(), z.unknown()).optional(),
});

export const POST = async (req: Request) => {
  try {
    const parsed = createFunctionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        {
          message: 'Invalid request body',
          error: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const created = await DspyManager.createPersistedFunction({
      id: parsed.data.id || crypto.randomUUID(),
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    });

    DspyFunctionRegistry.clearPersistedRegistrations();
    await DspyFunctionRegistry.hydrateFromDb();

    return Response.json(
      {
        function: created,
      },
      { status: 201 },
    );
  } catch (err: any) {
    const message = err?.message || 'Failed to create DSPy function';
    const status = message.includes('already exists') ? 409 : 500;

    return Response.json({ message }, { status });
  }
};
