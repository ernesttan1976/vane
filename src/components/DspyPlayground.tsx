'use client';

import { useEffect, useMemo, useState } from 'react';
import Markdown from 'markdown-to-jsx';
import { Select } from './ui/Select';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

type RegisteredFunction = {
  id: string;
  name: string;
  description: string;
  category: string;
  inputSchemaJson: Record<string, unknown>;
  outputSchemaJson: Record<string, unknown>;
  moduleType: 'ChainOfThought' | 'PredictModule';
  instructions: string;
  userPromptTemplate: string;
  formatterType: 'json' | 'morphology_matrix';
  safetyJson?: Record<string, unknown>;
  isBuiltin: boolean;
};

type ExecuteResult = {
  functionName: string;
  markdown: string;
  structured: Record<string, unknown>;
  metadata: {
    moduleType: string;
    retriesUsed: number;
  };
};

type ExecuteStreamEvent =
  | { type: 'chunk'; payload: ExecuteResult }
  | { type: 'result'; payload: ExecuteResult }
  | { type: 'error'; payload: { message: string } };

const DEFAULT_INPUT_BY_FUNCTION: Record<string, Record<string, unknown>> = {
  morphology_matrix: { word: 'happy' },
};

const DEFAULT_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
  },
  required: ['text'],
};

const DEFAULT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    result: { type: 'string' },
  },
  required: ['result'],
};

const MAX_STRUCTURED_CHARS = 2500;
const MAX_MARKDOWN_CHARS = 3500;

const truncateText = (input: string, max: number) => {
  if (input.length <= max) return input;
  return `${input.slice(0, max)}\n...[truncated]`;
};

const DspyPlayground = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'execute' | 'manage'>('execute');
  const [functions, setFunctions] = useState<RegisteredFunction[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [inputJson, setInputJson] = useState<string>('{}');
  const [output, setOutput] = useState<ExecuteResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loadingFunctions, setLoadingFunctions] = useState<boolean>(true);
  const [executing, setExecuting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

  const [formId, setFormId] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('language');
  const [formModuleType, setFormModuleType] = useState<
    'ChainOfThought' | 'PredictModule'
  >('PredictModule');
  const [formInstructions, setFormInstructions] = useState<string>('');
  const [formPromptTemplate, setFormPromptTemplate] = useState<string>('');
  const [formFormatterType, setFormFormatterType] = useState<
    'json' | 'morphology_matrix'
  >('json');
  const [formInputSchema, setFormInputSchema] = useState<string>(
    JSON.stringify(DEFAULT_INPUT_SCHEMA, null, 2),
  );
  const [formOutputSchema, setFormOutputSchema] = useState<string>(
    JSON.stringify(DEFAULT_OUTPUT_SCHEMA, null, 2),
  );
  const [formSafetyJson, setFormSafetyJson] = useState<string>(
    JSON.stringify({ retries: 1, maxTokens: 1200, temperature: 0.2 }, null, 2),
  );

  const selectedFunctionRecord = useMemo(
    () => functions.find((fn) => fn.name === selectedFunction),
    [functions, selectedFunction],
  );

  const resetForm = () => {
    setFormId('');
    setFormName('');
    setFormDescription('');
    setFormCategory('language');
    setFormModuleType('PredictModule');
    setFormInstructions('');
    setFormPromptTemplate('');
    setFormFormatterType('json');
    setFormInputSchema(JSON.stringify(DEFAULT_INPUT_SCHEMA, null, 2));
    setFormOutputSchema(JSON.stringify(DEFAULT_OUTPUT_SCHEMA, null, 2));
    setFormSafetyJson(
      JSON.stringify({ retries: 1, maxTokens: 1200, temperature: 0.2 }, null, 2),
    );
  };

  const applyFunctionToForm = (fn: RegisteredFunction) => {
    setFormId(fn.id);
    setFormName(fn.name);
    setFormDescription(fn.description);
    setFormCategory(fn.category);
    setFormModuleType(fn.moduleType);
    setFormInstructions(fn.instructions);
    setFormPromptTemplate(fn.userPromptTemplate || '');
    setFormFormatterType(fn.formatterType);
    setFormInputSchema(JSON.stringify(fn.inputSchemaJson, null, 2));
    setFormOutputSchema(JSON.stringify(fn.outputSchemaJson, null, 2));
    setFormSafetyJson(JSON.stringify(fn.safetyJson || {}, null, 2));
  };

  const loadFunctions = async (keepSelection = true) => {
    setLoadingFunctions(true);
    setError('');
    try {
      const res = await fetch('/api/dspy/functions');
      const data = await res.json();
      const list = (data?.functions || []) as RegisteredFunction[];
      setFunctions(list);

      if (list.length === 0) {
        setSelectedFunction('');
        resetForm();
        return;
      }

      const currentSelection =
        keepSelection && selectedFunction
          ? list.find((fn) => fn.name === selectedFunction)?.name
          : undefined;
      const nextSelection = currentSelection || list[0].name;
      setSelectedFunction(nextSelection);
      const selected = list.find((fn) => fn.name === nextSelection) || list[0];
      applyFunctionToForm(selected);
      setInputJson(
        JSON.stringify(
          DEFAULT_INPUT_BY_FUNCTION[selected.name] || { word: 'happy' },
          null,
          2,
        ),
      );
    } catch (_err) {
      setError('Failed to load DSPy functions.');
    } finally {
      setLoadingFunctions(false);
    }
  };

  useEffect(() => {
    loadFunctions(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedFunctionDescription = useMemo(() => {
    return (
      functions.find((fn) => fn.name === selectedFunction)?.description || ''
    );
  }, [functions, selectedFunction]);

  const executeFunction = async () => {
    setError('');
    setOutput(null);
    setExecuting(true);

    try {
      const input = JSON.parse(inputJson);
      const providerId = localStorage.getItem('chatModelProviderId');
      const modelKey = localStorage.getItem('chatModelKey');

      if (!providerId || !modelKey) {
        throw new Error(
          'No chat model selected. Choose a model in settings first.',
        );
      }

      const res = await fetch('/api/dspy/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          functionName: selectedFunction,
          input,
          chatModel: {
            providerId,
            key: modelKey,
          },
        }),
      });
      if (!res.ok || !res.body) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'Execution failed.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let finalResult: ExecuteResult | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });

        const lines = pending.split('\n');
        pending = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let event: ExecuteStreamEvent;
          try {
            event = JSON.parse(trimmed) as ExecuteStreamEvent;
          } catch {
            continue;
          }

          if (event.type === 'error') {
            throw new Error(event.payload.message || 'Execution failed.');
          }

          if (event.type === 'chunk') {
            setOutput(event.payload);
          }

          if (event.type === 'result') {
            finalResult = event.payload;
            setOutput(event.payload);
          }
        }
      }

      if (!finalResult) {
        throw new Error('Execution ended without a final result.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to execute DSPy function.');
    } finally {
      setExecuting(false);
    }
  };

  const saveFunction = async () => {
    setError('');
    setSaving(true);

    try {
      const inputSchemaJson = JSON.parse(formInputSchema);
      const outputSchemaJson = JSON.parse(formOutputSchema);
      const safetyJson = JSON.parse(formSafetyJson || '{}');

      const payload = {
        name: formName.trim(),
        description: formDescription.trim(),
        category: formCategory.trim(),
        inputSchemaJson,
        outputSchemaJson,
        moduleType: formModuleType,
        instructions: formInstructions.trim(),
        userPromptTemplate: formPromptTemplate.trim(),
        formatterType: formFormatterType,
        safetyJson,
      };

      if (!payload.name || !payload.description || !payload.category) {
        throw new Error('Name, description, and category are required.');
      }

      const isEdit = !!formId && !formId.startsWith('builtin:');
      const url = isEdit ? `/api/dspy/functions/${formId}` : '/api/dspy/functions';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to save DSPy function.');
      }

      await loadFunctions(false);
      setSelectedFunction(payload.name);
    } catch (err: any) {
      setError(err?.message || 'Failed to save DSPy function.');
    } finally {
      setSaving(false);
    }
  };

  const deleteFunction = async () => {
    if (!selectedFunctionRecord || selectedFunctionRecord.isBuiltin) {
      return;
    }

    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/dspy/functions/${selectedFunctionRecord.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to delete DSPy function.');
      }

      setOutput(null);
      await loadFunctions(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete DSPy function.');
    } finally {
      setDeleting(false);
    }
  };

  const continueInNewChat = () => {
    if (!output) return;

    const structured = truncateText(
      JSON.stringify(output.structured || {}, null, 2),
      MAX_STRUCTURED_CHARS,
    );
    const markdown = truncateText(output.markdown || '', MAX_MARKDOWN_CHARS);

    const chatPrompt = [
      `Use this DSPy output as context and continue from it.`,
      ``,
      `Function: ${output.functionName}`,
      `Module type: ${output.metadata.moduleType}`,
      `Retries used: ${output.metadata.retriesUsed}`,
      ``,
      `DSPy Markdown Output:`,
      markdown,
      ``,
      `DSPy Structured Output (JSON):`,
      structured,
      ``,
      `Please continue the task based on this output.`,
    ].join('\n');

    router.push(`/?q=${encodeURIComponent(chatPrompt)}`);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-black dark:text-white">
          DSPy Function Playground
        </h1>
        <p className="text-sm text-black/60 dark:text-white/60 mt-1">
          Run registered DSPy functions with custom JSON input. Includes the
          built-in morphology matrix example.
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-light-200 dark:border-dark-200 p-1 bg-light-secondary dark:bg-dark-secondary">
        <button
          onClick={() => setActiveTab('execute')}
          className={`px-3 py-1.5 text-sm rounded-md transition ${
            activeTab === 'execute'
              ? 'bg-[#24A0ED] text-white'
              : 'text-black dark:text-white hover:bg-light-200 dark:hover:bg-dark-200'
          }`}
        >
          Execute
        </button>
        <button
          onClick={() => setActiveTab('manage')}
          className={`px-3 py-1.5 text-sm rounded-md transition ${
            activeTab === 'manage'
              ? 'bg-[#24A0ED] text-white'
              : 'text-black dark:text-white hover:bg-light-200 dark:hover:bg-dark-200'
          }`}
        >
          Manage
        </button>
      </div>

      {activeTab === 'execute' && (
        <div className="rounded-xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary p-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-black dark:text-white">
              Function
            </label>
            <Select
              value={selectedFunction}
              loading={loadingFunctions}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedFunction(value);
                const selected = functions.find((fn) => fn.name === value);
                if (selected) {
                  applyFunctionToForm(selected);
                }
                setInputJson(
                  JSON.stringify(
                    DEFAULT_INPUT_BY_FUNCTION[value] || { word: 'happy' },
                    null,
                    2,
                  ),
                );
              }}
              options={
                functions.length > 0
                  ? functions.map((fn) => ({
                      value: fn.name,
                      label: `${fn.name} (${fn.category})`,
                    }))
                  : [{ value: '', label: 'No functions available', disabled: true }]
              }
            />
            {selectedFunctionDescription && (
              <p className="text-xs text-black/60 dark:text-white/60">
                {selectedFunctionDescription}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-black dark:text-white">
              Input JSON
            </label>
            <textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              className="w-full min-h-36 rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-sm text-black dark:text-white p-3 font-mono"
            />
          </div>

          <button
            onClick={executeFunction}
            disabled={
              loadingFunctions ||
              executing ||
              !selectedFunction ||
              functions.length === 0
            }
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-[#24A0ED] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {executing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Executing...
              </>
            ) : (
              'Execute function'
            )}
          </button>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="rounded-xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black dark:text-white">
              Manage DSPy Functions
            </h2>
            <button
              onClick={resetForm}
              className="rounded-md px-3 py-1.5 border border-light-200 dark:border-dark-200 text-xs text-black dark:text-white hover:bg-light-200 dark:hover:bg-dark-200 transition"
            >
              New function
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Function name"
              className="rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-sm text-black dark:text-white p-2.5"
            />
            <input
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              placeholder="Category"
              className="rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-sm text-black dark:text-white p-2.5"
            />
          </div>

          <textarea
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Description"
            className="w-full min-h-20 rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-sm text-black dark:text-white p-3"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <Select
              value={formModuleType}
              onChange={(e) =>
                setFormModuleType(
                  e.target.value as 'ChainOfThought' | 'PredictModule',
                )
              }
              options={[
                { value: 'PredictModule', label: 'PredictModule' },
                { value: 'ChainOfThought', label: 'ChainOfThought' },
              ]}
            />
            <Select
              value={formFormatterType}
              onChange={(e) =>
                setFormFormatterType(
                  e.target.value as 'json' | 'morphology_matrix',
                )
              }
              options={[
                { value: 'json', label: 'json' },
                { value: 'morphology_matrix', label: 'morphology_matrix' },
              ]}
            />
          </div>

          <textarea
            value={formInstructions}
            onChange={(e) => setFormInstructions(e.target.value)}
            placeholder="Module instructions"
            className="w-full min-h-24 rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-sm text-black dark:text-white p-3"
          />
          <textarea
            value={formPromptTemplate}
            onChange={(e) => setFormPromptTemplate(e.target.value)}
            placeholder="User prompt template, e.g. Base word: {{word}}"
            className="w-full min-h-20 rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-sm text-black dark:text-white p-3"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <textarea
              value={formInputSchema}
              onChange={(e) => setFormInputSchema(e.target.value)}
              placeholder="Input JSON schema"
              className="w-full min-h-44 rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-xs text-black dark:text-white p-3 font-mono"
            />
            <textarea
              value={formOutputSchema}
              onChange={(e) => setFormOutputSchema(e.target.value)}
              placeholder="Output JSON schema"
              className="w-full min-h-44 rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-xs text-black dark:text-white p-3 font-mono"
            />
          </div>

          <textarea
            value={formSafetyJson}
            onChange={(e) => setFormSafetyJson(e.target.value)}
            placeholder="Safety JSON"
            className="w-full min-h-24 rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary text-xs text-black dark:text-white p-3 font-mono"
          />

          <div className="flex items-center gap-2">
            <button
              onClick={saveFunction}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-[#24A0ED] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {formId && !formId.startsWith('builtin:')
                ? 'Update function'
                : 'Create function'}
            </button>
            <button
              onClick={deleteFunction}
              disabled={
                deleting ||
                !selectedFunctionRecord ||
                selectedFunctionRecord.isBuiltin
              }
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 border border-red-300/60 text-red-700 dark:text-red-300 text-sm font-medium hover:bg-red-500/10 transition disabled:opacity-40"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Delete selected
            </button>
          </div>

          {selectedFunctionRecord?.isBuiltin && (
            <p className="text-xs text-black/60 dark:text-white/60">
              Built-in functions can be executed but not deleted.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-300/50 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {output && (
        <div className="rounded-xl border border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary p-5">
          <div className="text-xs text-black/60 dark:text-white/60 mb-4">
            Module: <span className="font-medium">{output.metadata.moduleType}</span>{' '}
            | Retries used: <span className="font-medium">{output.metadata.retriesUsed}</span>
          </div>
          <Markdown
            className={
              'prose prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h3:mt-4 prose-h3:mb-1.5 dark:prose-invert max-w-none break-words text-black dark:text-white'
            }
          >
            {output.markdown}
          </Markdown>
          <div className="mt-4">
            <button
              onClick={continueInNewChat}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 border border-light-200 dark:border-dark-200 text-sm font-medium text-black dark:text-white hover:bg-light-200 dark:hover:bg-dark-200 transition"
            >
              Continue in New Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DspyPlayground;
