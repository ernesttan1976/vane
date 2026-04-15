import z from 'zod';
import { ResearchAction } from '../../../types';
import { executeDspyFunction } from '@/lib/dspy/runtime';

const actionSchema = z.object({
  type: z.literal('dspy_function'),
  functionName: z
    .string()
    .describe('Name of the registered DSPy function to execute.'),
  input: z
    .record(z.string(), z.unknown())
    .describe('Input payload for the DSPy function.'),
});

const actionDescription = `
Use this tool to execute a registered DSPy function when the user asks for a structured transformation.
This tool is especially useful for language-learning tasks like morphology matrix generation.

Rules:
- Pick a registered function name.
- Pass only the fields needed by that function.
- Use this when the user asks for deterministic, structured educational outputs.
`;

const dspyFunctionAction: ResearchAction<typeof actionSchema> = {
  name: 'dspy_function',
  schema: actionSchema,
  getToolDescription: () =>
    'Execute a registered DSPy function for structured generation tasks.',
  getDescription: () => actionDescription,
  enabled: () => true,
  execute: async (input, additionalConfig) => {
    const result = await executeDspyFunction({
      functionName: input.functionName,
      input: input.input,
      llm: additionalConfig.llm,
    });

    return {
      type: 'search_results',
      results: [
        {
          content: result.markdown,
          metadata: {
            title: `DSPy Function: ${result.functionName}`,
            url: `local://dspy/${result.functionName}`,
            dspy: true,
            moduleType: result.metadata.moduleType,
          },
        },
      ],
    };
  },
};

export default dspyFunctionAction;
