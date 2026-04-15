import { z } from 'zod';
import DspyManager from '@/lib/dspy/manager';
import DspyFunctionRegistry from '@/lib/dspy/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateFunctionSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  inputSchemaJson: z.record(z.string(), z.unknown()).optional(),
  outputSchemaJson: z.record(z.string(), z.unknown()).optional(),
  moduleType: z.enum(['ChainOfThought', 'PredictModule']).optional(),
  instructions: z.string().min(1).optional(),
  userPromptTemplate: z.string().min(1).optional(),
  formatterType: z.enum(['json', 'morphology_matrix']).optional(),
  safetyJson: z.record(z.string(), z.unknown()).optional(),
});

export const PATCH = async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const parsed = updateFunctionSchema.safeParse(await req.json());

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

    const updated = await DspyManager.updatePersistedFunction(id, parsed.data);

    DspyFunctionRegistry.clearPersistedRegistrations();
    await DspyFunctionRegistry.hydrateFromDb();

    return Response.json({ function: updated }, { status: 200 });
  } catch (err: any) {
    const message = err?.message || 'Failed to update DSPy function';
    const status = message.includes('not found')
      ? 404
      : message.includes('already exists')
        ? 409
        : 500;

    return Response.json({ message }, { status });
  }
};

export const DELETE = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    await DspyManager.deletePersistedFunction(id);

    DspyFunctionRegistry.clearPersistedRegistrations();
    await DspyFunctionRegistry.hydrateFromDb();

    return Response.json({ message: 'DSPy function deleted successfully.' });
  } catch (err: any) {
    const message = err?.message || 'Failed to delete DSPy function';
    const status = message.includes('not found') ? 404 : 500;
    return Response.json({ message }, { status });
  }
};
