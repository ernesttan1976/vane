import z from 'zod';
import BaseLLM from '@/lib/models/base/llm';

export const dspySafetySchema = z.object({
  maxTokens: z.number().int().positive().default(1200),
  temperature: z.number().min(0).max(2).default(0.2),
  topP: z.number().min(0).max(1).optional(),
  timeoutMs: z.number().int().positive().default(20000),
  retries: z.number().int().min(0).max(3).default(1),
  allowedModels: z.array(z.string()).optional(),
});

export type DspySafetyConfig = z.infer<typeof dspySafetySchema>;

export type DspyModuleConfig<TInput> = {
  moduleType: 'ChainOfThought' | 'PredictModule';
  instructions: string;
  buildUserPrompt: (input: TInput) => string;
};

export interface DspyFunctionDefinition<
  TInputSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny = z.ZodTypeAny,
> {
  name: string;
  description: string;
  category: string;
  inputSchema: TInputSchema;
  outputSchema: TOutputSchema;
  moduleConfig: DspyModuleConfig<z.infer<TInputSchema>>;
  formatter: (output: z.infer<TOutputSchema>) => string;
  safety?: Partial<DspySafetyConfig>;
}

export type DspyExecutionRequest = {
  functionName: string;
  input: unknown;
  llm: BaseLLM<any>;
};

export type DspyExecutionResult<T = unknown> = {
  functionName: string;
  markdown: string;
  structured: T;
  metadata: {
    moduleType: string;
    retriesUsed: number;
  };
};

export const dspyModuleTypeSchema = z.enum(['ChainOfThought', 'PredictModule']);
export const dspyFormatterTypeSchema = z.enum(['json', 'morphology_matrix']);

export const dspyPersistedFunctionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  inputSchemaJson: z.record(z.string(), z.unknown()),
  outputSchemaJson: z.record(z.string(), z.unknown()),
  moduleType: dspyModuleTypeSchema,
  instructions: z.string().min(1),
  userPromptTemplate: z.string().min(1),
  formatterType: dspyFormatterTypeSchema,
  safetyJson: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type DspyFunctionRecord = z.infer<typeof dspyPersistedFunctionSchema>;
