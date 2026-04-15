import z from 'zod';
import DspyFunctionRegistry from './registry';
import {
  DspyExecutionRequest,
  DspyExecutionResult,
  dspySafetySchema,
} from './types';

const maybeLoadDspy = async () => {
  try {
    return await import('dspy.ts/modules');
  } catch {
    return null;
  }
};

export const executeDspyFunction = async (
  request: DspyExecutionRequest,
): Promise<DspyExecutionResult> => {
  const definition = DspyFunctionRegistry.get(request.functionName);

  if (!definition) {
    throw new Error(`DSPy function "${request.functionName}" is not registered.`);
  }

  const parsedInput = definition.inputSchema.safeParse(request.input);
  if (!parsedInput.success) {
    throw new Error(
      `Invalid input: ${z.prettifyError(parsedInput.error)}`,
    );
  }

  const safety = dspySafetySchema.parse(definition.safety || {});
  const dspyModules = await maybeLoadDspy();
  const hasDspyRuntime = Boolean(dspyModules);
  let retriesUsed = 0;

  while (retriesUsed <= safety.retries) {
    try {
      const modelResponse = await request.llm.generateObject({
        schema: definition.outputSchema,
        messages: [
          {
            role: 'system',
            content: `${definition.moduleConfig.instructions}\n\nUse module style: ${definition.moduleConfig.moduleType}.`,
          },
          {
            role: 'user',
            content: definition.moduleConfig.buildUserPrompt(parsedInput.data),
          },
        ],
        options: {
          maxTokens: safety.maxTokens,
          temperature: safety.temperature,
          topP: safety.topP,
        },
      });

      const parsedOutput = definition.outputSchema.parse(modelResponse);
      const markdown = definition.formatter(parsedOutput);

      return {
        functionName: definition.name,
        markdown,
        structured: parsedOutput,
        metadata: {
          moduleType: hasDspyRuntime
            ? definition.moduleConfig.moduleType
            : `${definition.moduleConfig.moduleType} (compat)`,
          retriesUsed,
        },
      };
    } catch (error) {
      if (retriesUsed >= safety.retries) {
        throw error;
      }
      retriesUsed += 1;
    }
  }

  throw new Error('DSPy runtime execution failed unexpectedly.');
};
