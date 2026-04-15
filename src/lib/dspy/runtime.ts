import z from 'zod';
import { repairJson } from '@toolsycc/json-repair';
import DspyFunctionRegistry from './registry';
import {
  DspyExecutionRequest,
  DspyExecutionResult,
  dspySafetySchema,
} from './types';
import { Message } from '@/lib/types';

const runStructuredGeneration = async (
  request: DspyExecutionRequest,
  definition: NonNullable<ReturnType<typeof DspyFunctionRegistry.get>>,
  input: unknown,
  safety: z.infer<typeof dspySafetySchema>,
) => {
  const fallbackMaxTokens = Math.max(safety.maxTokens, 2800);
  const baseMessages: Message[] = [
    {
      role: 'system',
      content: `${definition.moduleConfig.instructions}\n\nUse module style: ${definition.moduleConfig.moduleType}.`,
    },
    {
      role: 'user',
      content: definition.moduleConfig.buildUserPrompt(input),
    },
  ];

  try {
    return await request.llm.generateObject({
      schema: definition.outputSchema,
      messages: baseMessages,
      options: {
        maxTokens: safety.maxTokens,
        temperature: safety.temperature,
        topP: safety.topP,
      },
    });
  } catch (primaryError: any) {
    const fallbackPrompt = `${definition.moduleConfig.buildUserPrompt(input)}

Return ONLY valid JSON that matches this schema description:
${JSON.stringify(z.toJSONSchema(definition.outputSchema))}

Keep the JSON compact and concise:
- no markdown
- no code fences
- no explanations
- no pretty formatting
- keep text fields brief
`;

    const textResponse = await request.llm.generateText({
      messages: [
        {
          role: 'system',
          content:
            `${definition.moduleConfig.instructions}\n` +
            'You must output valid JSON only. No markdown, no backticks, no extra text.',
        },
        {
          role: 'user',
          content: fallbackPrompt,
        },
      ],
      options: {
        maxTokens: fallbackMaxTokens,
        temperature: Math.min(safety.temperature, 0.2),
        topP: safety.topP,
      },
    });

    try {
      return JSON.parse(
        repairJson(textResponse.content, { extractJson: true }) as string,
      );
    } catch (fallbackParseError: any) {
      const compactRetryResponse = await request.llm.generateText({
        messages: [
          {
            role: 'system',
            content:
              `${definition.moduleConfig.instructions}\n` +
              'Output ONLY one single-line JSON object. Do not include markdown. Keep every text value short.',
          },
          {
            role: 'user',
            content:
              `Input: ${JSON.stringify(input)}\n` +
              `Schema: ${JSON.stringify(z.toJSONSchema(definition.outputSchema))}\n` +
              'Return a complete JSON object in one line.',
          },
        ],
        options: {
          maxTokens: fallbackMaxTokens + 600,
          temperature: 0.1,
          topP: safety.topP,
        },
      });

      try {
        return JSON.parse(
          repairJson(compactRetryResponse.content, {
            extractJson: true,
          }) as string,
        );
      } catch (secondFallbackParseError: any) {
        throw new Error(
          `Structured generation failed. Primary error: ${primaryError?.message || primaryError}. Fallback parsing error: ${fallbackParseError?.message || fallbackParseError}. Retry parsing error: ${secondFallbackParseError?.message || secondFallbackParseError}`,
        );
      }
    }
  }
};

export const executeDspyFunction = async (
  request: DspyExecutionRequest,
): Promise<DspyExecutionResult> => {
  await DspyFunctionRegistry.hydrateFromDb();
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
  let retriesUsed = 0;

  while (retriesUsed <= safety.retries) {
    try {
      const modelResponse = await runStructuredGeneration(
        request,
        definition,
        parsedInput.data,
        safety,
      );

      const parsedOutput = definition.outputSchema.parse(modelResponse);
      const markdown = definition.formatter(parsedOutput);

      return {
        functionName: definition.name,
        markdown,
        structured: parsedOutput,
        metadata: {
          moduleType: definition.moduleConfig.moduleType,
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
