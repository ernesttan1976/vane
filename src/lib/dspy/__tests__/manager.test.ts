import assert from 'node:assert/strict';
import test from 'node:test';
import DspyManager from '../manager';
import { DspyFunctionRecord } from '../types';

const baseRecord: DspyFunctionRecord = {
  id: 'test-id',
  name: 'json_echo',
  description: 'Echo payload as JSON',
  category: 'testing',
  inputSchemaJson: {
    type: 'object',
    properties: {
      word: { type: 'string' },
      count: { type: 'integer' },
    },
    required: ['word'],
  },
  outputSchemaJson: {
    type: 'object',
    properties: {
      echoed: { type: 'string' },
    },
    required: ['echoed'],
  },
  moduleType: 'PredictModule',
  instructions: 'Echo the input.',
  userPromptTemplate: 'Word: {{word}} / Count: {{count}}',
  formatterType: 'json',
  safetyJson: {
    maxTokens: 1000,
    retries: 1,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

test('compileDefinition builds prompt from template placeholders', () => {
  const compiled = DspyManager.compileDefinition(baseRecord);
  const prompt = compiled.moduleConfig.buildUserPrompt({
    word: 'happy',
    count: 3,
  });

  assert.equal(prompt, 'Word: happy / Count: 3');
});

test('compileDefinition validates required input fields from JSON schema', () => {
  const compiled = DspyManager.compileDefinition(baseRecord);
  const invalidResult = compiled.inputSchema.safeParse({ count: 2 });

  assert.equal(invalidResult.success, false);
});

test('compileDefinition json formatter produces markdown code block', () => {
  const compiled = DspyManager.compileDefinition(baseRecord);
  const markdown = compiled.formatter({ echoed: 'hello' });

  assert.match(markdown, /```json/);
  assert.match(markdown, /"echoed": "hello"/);
});
