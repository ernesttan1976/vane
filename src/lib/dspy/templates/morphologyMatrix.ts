import z from 'zod';
import { DspyFunctionDefinition } from '../types';
import {
  formatMorphologyMatrixMarkdown,
  MorphologyMatrixOutput,
} from '../formatters/morphologyMatrix';

const morphemePartSchema = z.object({
  form: z.string(),
  meaning: z.string(),
});

const morphologyRowSchema = z.object({
  baseRoot: z.string(),
  morphemeBreakdown: z.string().describe('Explicit hyphenated segmentation'),
  prefixes: z.array(morphemePartSchema),
  root: morphemePartSchema,
  suffixes: z.array(morphemePartSchema),
  partOfSpeech: z.string(),
  meaningShift: z.string(),
  exampleWords: z.array(z.string()).min(1).max(5),
  exampleSentence: z.string(),
  rarity: z.enum(['common', 'rare/uncommon']),
});

const derivedWordSchema = z.object({
  word: z.string(),
  morphemeBreakdown: z.string(),
  note: z.string().nullable(),
});

export const morphologyMatrixInputSchema = z.object({
  word: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z-]+$/, 'word must contain only letters and hyphen'),
});

export const morphologyMatrixOutputSchema = z.object({
  baseWord: z.string(),
  rows: z.array(morphologyRowSchema).min(5).max(12),
  topDerivedWords: z.array(derivedWordSchema).min(5).max(10),
  teachingNote: z.string(),
  practiceExercise: z.string(),
});

const morphologyInstructions = `
Create a pedagogical morphology matrix for the base word.

Rules:
- Use real, commonly used English words.
- Use explicit morpheme segmentation with hyphens (example: un-happi-ness).
- Explain function of each morpheme with meaning and grammatical role.
- Prioritize derivational morphology over simple inflections.
- Include inflections only if they add learning value.
- Do not invent words.
- Mark rare forms as "rare/uncommon".
- Ensure rows are linguistically accurate.
- Provide learner-friendly examples and example sentences.
`;

const morphologyMatrixDefinition: DspyFunctionDefinition<
  typeof morphologyMatrixInputSchema,
  typeof morphologyMatrixOutputSchema
> = {
  name: 'morphology_matrix',
  description:
    'Generate a word morphology matrix with explicit morpheme breakdown and teaching sections.',
  category: 'language',
  inputSchema: morphologyMatrixInputSchema,
  outputSchema: morphologyMatrixOutputSchema,
  moduleConfig: {
    moduleType: 'ChainOfThought',
    instructions: morphologyInstructions.trim(),
    buildUserPrompt: (input) =>
      `Base word: ${input.word}\nReturn the structured morphology matrix output.`,
  },
  formatter: (output) =>
    formatMorphologyMatrixMarkdown(output as MorphologyMatrixOutput),
  safety: {
    maxTokens: 1600,
    temperature: 0.2,
    retries: 1,
    timeoutMs: 25000,
  },
};

export default morphologyMatrixDefinition;
