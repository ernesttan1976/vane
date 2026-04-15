import assert from 'node:assert/strict';
import test from 'node:test';
import z from 'zod';
import BaseLLM from '@/lib/models/base/llm';
import { executeDspyFunction } from '../runtime';
import DspyFunctionRegistry from '../registry';
import { DspyFunctionDefinition } from '../types';
import {
  GenerateObjectInput,
  GenerateTextInput,
  StreamTextOutput,
} from '@/lib/models/types';

class MockLLM extends BaseLLM<{ payload: unknown }> {
  constructor(payload: unknown) {
    super({ payload });
  }

  async generateText(_input: GenerateTextInput) {
    return { content: '', toolCalls: [] };
  }

  async *streamText(
    _input: GenerateTextInput,
  ): AsyncGenerator<StreamTextOutput> {
    yield { contentChunk: '', toolCallChunk: [] };
  }

  async generateObject<T>(_input: GenerateObjectInput): Promise<T> {
    return this.config.payload as T;
  }

  async *streamObject<T>(
    _input: GenerateObjectInput,
  ): AsyncGenerator<Partial<T>> {
    yield this.config.payload as T;
  }
}

test('registry includes morphology_matrix default function', () => {
  const hasMorphology = DspyFunctionRegistry.list().some(
    (fn) => fn.name === 'morphology_matrix',
  );
  assert.equal(hasMorphology, true);
});

test('runtime validates malformed input against schema', async () => {
  const llm = new MockLLM({});

  await assert.rejects(
    () =>
      executeDspyFunction({
        functionName: 'morphology_matrix',
        input: { word: '123' },
        llm,
      }),
    /Invalid input/,
  );
});

test('runtime can execute registered custom function', async () => {
  const fn: DspyFunctionDefinition = {
    name: 'unit_test_echo',
    description: 'Echoes text',
    category: 'testing',
    inputSchema: z.object({ text: z.string() }),
    outputSchema: z.object({ echoed: z.string() }),
    moduleConfig: {
      moduleType: 'PredictModule',
      instructions: 'Echo input',
      buildUserPrompt: (input) => (input as { text: string }).text,
    },
    formatter: (output: any) => `# ${output.echoed}`,
  };

  DspyFunctionRegistry.register(fn);

  const llm = new MockLLM({ echoed: 'hello' });
  const result = await executeDspyFunction({
    functionName: 'unit_test_echo',
    input: { text: 'hello' },
    llm,
  });

  assert.equal(result.markdown, '# hello');
  assert.equal((result.structured as any).echoed, 'hello');
});
