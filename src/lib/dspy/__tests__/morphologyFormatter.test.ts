import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMorphologyMatrixMarkdown } from '../formatters/morphologyMatrix';

test('morphology formatter includes matrix and teaching sections', () => {
  const markdown = formatMorphologyMatrixMarkdown({
    baseWord: 'happy',
    rows: [
      {
        baseRoot: 'happi',
        morphemeBreakdown: 'un-happi-ness',
        prefixes: [{ form: 'un-', meaning: 'not' }],
        root: { form: 'happi', meaning: 'pleased' },
        suffixes: [{ form: '-ness', meaning: 'state or quality' }],
        partOfSpeech: 'noun',
        meaningShift: 'state of not being happy',
        exampleWords: ['unhappiness'],
        exampleSentence: 'Her unhappiness was clear after the news.',
        rarity: 'common',
      },
      {
        baseRoot: 'happi',
        morphemeBreakdown: 'happi-ly',
        prefixes: [],
        root: { form: 'happi', meaning: 'pleased' },
        suffixes: [{ form: '-ly', meaning: 'adverb maker' }],
        partOfSpeech: 'adverb',
        meaningShift: 'in a happy manner',
        exampleWords: ['happily'],
        exampleSentence: 'The children played happily in the yard.',
        rarity: 'common',
      },
      {
        baseRoot: 'happi',
        morphemeBreakdown: 'happi-ness',
        prefixes: [],
        root: { form: 'happi', meaning: 'pleased' },
        suffixes: [{ form: '-ness', meaning: 'state or quality' }],
        partOfSpeech: 'noun',
        meaningShift: 'the state of being happy',
        exampleWords: ['happiness'],
        exampleSentence: 'Happiness improved after she changed jobs.',
        rarity: 'common',
      },
      {
        baseRoot: 'happi',
        morphemeBreakdown: 'happi-er',
        prefixes: [],
        root: { form: 'happi', meaning: 'pleased' },
        suffixes: [{ form: '-er', meaning: 'comparative adjective' }],
        partOfSpeech: 'adjective',
        meaningShift: 'more happy',
        exampleWords: ['happier'],
        exampleSentence: 'He felt happier after exercising regularly.',
        rarity: 'common',
      },
      {
        baseRoot: 'happi',
        morphemeBreakdown: 'happi-est',
        prefixes: [],
        root: { form: 'happi', meaning: 'pleased' },
        suffixes: [{ form: '-est', meaning: 'superlative adjective' }],
        partOfSpeech: 'adjective',
        meaningShift: 'most happy',
        exampleWords: ['happiest'],
        exampleSentence: 'That was the happiest day of her life.',
        rarity: 'common',
      },
    ],
    topDerivedWords: [
      { word: 'unhappiness', morphemeBreakdown: 'un-happi-ness' },
      { word: 'happiness', morphemeBreakdown: 'happi-ness' },
      { word: 'happily', morphemeBreakdown: 'happi-ly' },
      { word: 'happier', morphemeBreakdown: 'happi-er' },
      { word: 'happiest', morphemeBreakdown: 'happi-est' },
    ],
    teachingNote:
      'The base root happi forms both nouns and adverbs by adding derivational suffixes.',
    practiceExercise:
      'Identify the prefix, root, and suffix in the words unhappiness and happily.',
  });

  assert.equal(markdown.includes('## Morphology Matrix: happy'), true);
  assert.equal(markdown.includes('### Most useful derived words'), true);
  assert.equal(markdown.includes('### Teaching note'), true);
  assert.equal(markdown.includes('### Mini practice exercise'), true);
  assert.equal(markdown.includes('| Base / Root | Morpheme Breakdown |'), true);
});
