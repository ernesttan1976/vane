type MorphemePart = {
  form: string;
  meaning: string;
};

type MorphologyRow = {
  baseRoot: string;
  morphemeBreakdown: string;
  prefixes: MorphemePart[];
  root: MorphemePart;
  suffixes: MorphemePart[];
  partOfSpeech: string;
  meaningShift: string;
  exampleWords: string[];
  exampleSentence: string;
  rarity: 'common' | 'rare/uncommon';
};

type DerivedWord = {
  word: string;
  morphemeBreakdown: string;
  note?: string;
};

export type MorphologyMatrixOutput = {
  baseWord: string;
  rows: MorphologyRow[];
  topDerivedWords: DerivedWord[];
  teachingNote: string;
  practiceExercise: string;
};

const formatMorphemeList = (parts: MorphemePart[]) => {
  if (parts.length === 0) return '-';
  return parts.map((part) => `${part.form} (${part.meaning})`).join(', ');
};

const escapeCell = (value: string) => value.replaceAll('|', '\\|').trim();

export const formatMorphologyMatrixMarkdown = (
  output: MorphologyMatrixOutput,
) => {
  const header = `## Morphology Matrix: ${output.baseWord}`;
  const tableHeader =
    '| Base / Root | Morpheme Breakdown | Prefix(es) + meaning | Root + meaning | Suffix(es) + meaning | Part of speech | Meaning shift | Example words | Example sentence |';
  const divider =
    '|---|---|---|---|---|---|---|---|---|';

  const rows = output.rows.map((row) => {
    const rowValues = [
      row.baseRoot,
      row.rarity === 'rare/uncommon'
        ? `${row.morphemeBreakdown} (rare/uncommon)`
        : row.morphemeBreakdown,
      formatMorphemeList(row.prefixes),
      `${row.root.form} (${row.root.meaning})`,
      formatMorphemeList(row.suffixes),
      row.partOfSpeech,
      row.meaningShift,
      row.exampleWords.join(', '),
      row.exampleSentence,
    ].map(escapeCell);

    return `| ${rowValues.join(' | ')} |`;
  });

  const derivedWords = output.topDerivedWords
    .slice(0, 10)
    .map((item) => {
      const note = item.note ? ` - ${item.note}` : '';
      return `- \`${item.word}\` -> \`${item.morphemeBreakdown}\`${note}`;
    })
    .join('\n');

  return [
    header,
    '',
    tableHeader,
    divider,
    ...rows,
    '',
    '### Most useful derived words',
    derivedWords,
    '',
    '### Teaching note',
    output.teachingNote,
    '',
    '### Mini practice exercise',
    output.practiceExercise,
  ].join('\n');
};
