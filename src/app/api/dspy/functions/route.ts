import DspyFunctionRegistry from '@/lib/dspy/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async () => {
  return Response.json({
    functions: DspyFunctionRegistry.list(),
  });
};
