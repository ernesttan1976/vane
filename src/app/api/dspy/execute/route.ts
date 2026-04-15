import { z } from 'zod';
import ModelRegistry from '@/lib/models/registry';
import { ModelWithProvider } from '@/lib/models/types';
import { streamExecuteDspyFunction } from '@/lib/dspy/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const chatModelSchema: z.ZodType<ModelWithProvider> = z.object({
  providerId: z.string({ message: 'Chat model provider id must be provided' }),
  key: z.string({ message: 'Chat model key must be provided' }),
});

const executeSchema = z.object({
  functionName: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  chatModel: chatModelSchema,
});

export const POST = async (req: Request) => {
  try {
    const parsed = executeSchema.safeParse(await req.json());
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

    const { functionName, input, chatModel } = parsed.data;
    const registry = new ModelRegistry();
    const llm = await registry.loadChatModel(chatModel.providerId, chatModel.key);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of streamExecuteDspyFunction({
            functionName,
            input,
            llm,
          })) {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          }
          controller.close();
        } catch (error: any) {
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: 'error',
                payload: { message: error?.message || 'Execution failed.' },
              })}\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error(`Failed to execute DSPy function: ${err?.message || err}`);
    return Response.json(
      { message: err?.message || 'Failed to execute DSPy function' },
      { status: 500 },
    );
  }
};
