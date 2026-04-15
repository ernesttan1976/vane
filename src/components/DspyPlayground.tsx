'use client';

import { useEffect, useMemo, useState } from 'react';
import Markdown from 'markdown-to-jsx';
import { Select } from './ui/Select';
import { Loader2 } from 'lucide-react';

type RegisteredFunction = {
  name: string;
  description: string;
  category: string;
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

const DEFAULT_INPUT_BY_FUNCTION: Record<string, Record<string, unknown>> = {
  morphology_matrix: { word: 'happy' },
};

const DspyPlayground = () => {
  const [functions, setFunctions] = useState<RegisteredFunction[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [inputJson, setInputJson] = useState<string>('{}');
  const [output, setOutput] = useState<ExecuteResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loadingFunctions, setLoadingFunctions] = useState<boolean>(true);
  const [executing, setExecuting] = useState<boolean>(false);

  useEffect(() => {
    const loadFunctions = async () => {
      setLoadingFunctions(true);
      setError('');
      try {
        const res = await fetch('/api/dspy/functions');
        const data = await res.json();
        const list = (data?.functions || []) as RegisteredFunction[];
        setFunctions(list);

        if (list.length > 0) {
          const defaultFn = list[0].name;
          setSelectedFunction(defaultFn);
          setInputJson(
            JSON.stringify(
              DEFAULT_INPUT_BY_FUNCTION[defaultFn] || { word: 'happy' },
              null,
              2,
            ),
          );
        }
      } catch (err) {
        setError('Failed to load DSPy functions.');
      } finally {
        setLoadingFunctions(false);
      }
    };

    loadFunctions();
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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'Execution failed.');
      }

      setOutput(data as ExecuteResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to execute DSPy function.');
    } finally {
      setExecuting(false);
    }
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
            loadingFunctions || executing || !selectedFunction || functions.length === 0
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
        </div>
      )}
    </div>
  );
};

export default DspyPlayground;
