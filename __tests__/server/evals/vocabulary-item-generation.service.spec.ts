import { describe, expect, it } from 'vitest';
import { generateVocabularyItemData } from '@/server/vocabulary/vocabulary-item-generation.service';
import { PartOfSpeech } from '@/const/vocabulary';
import type { GeneratedVocabularyItemDto } from '@/server/vocabulary/dtos/generated-vocabulary-item.dto';

describe.concurrent('vocabulary-item-generation.service', () => {
  const assertShape = (output: GeneratedVocabularyItemDto) => {
    expect(typeof output.value).toBe('string');
    expect(output.value.length).toBeGreaterThan(0);
    expect(output.value.length).toBeLessThanOrEqual(255);

    expect(typeof output.definition).toBe('string');
    expect(output.definition.length).toBeGreaterThan(0);
    expect(output.definition.length).toBeLessThanOrEqual(512);
    expect(output.definition).not.toMatch(/\.$/u);
    expect(output.definition).toMatch(/^[^A-Z]/u);

    expect(typeof output.uaTranslation).toBe('string');
    expect(output.uaTranslation.length).toBeGreaterThan(0);
    expect(output.uaTranslation.length).toBeLessThanOrEqual(255);
    expect(output.uaTranslation).not.toMatch(/;/u);
    expect(output.uaTranslation.split('/').length).toBeLessThanOrEqual(2);

    expect(typeof output.spelling).toBe('string');
    expect(output.spelling.length).toBeGreaterThan(0);
    expect(output.spelling.length).toBeLessThanOrEqual(255);
    expect(output.spelling).toMatch(/^\/[^/]+\/$/u);

    expect(output.partOfSpeech === null || Object.values(PartOfSpeech).includes(output.partOfSpeech)).toBe(true);
  };

  describe('generateVocabularyItemData', () => {
    it('generates a full entry for an unambiguous single word', async () => {
      const { output } = await generateVocabularyItemData({ value: 'elephant' });
      console.log('unambiguous-word', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.partOfSpeech).toBe(PartOfSpeech.Noun);

      await expect(output).toSatisfyStatements([
        'value is "elephant".',
        'definition is a concise English dictionary-style definition describing the large animal, with no examples or translations.',
        'uaTranslation is the natural Ukrainian word for the animal ("слон", case-insensitive).',
      ]);
    });

    it('defaults to the most common part of speech when no context disambiguates', async () => {
      const { output } = await generateVocabularyItemData({ value: 'run' });
      console.log('ambiguous-word-no-context', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.partOfSpeech).toBe(PartOfSpeech.Verb);

      await expect(output).toSatisfyStatements([
        'value is "run".',
        'definition describes the verb sense of moving fast on foot, not the noun sense (e.g. "a run"/"a batting run").',
      ]);
    });

    it('uses the context to pick a non-default part of speech and sense', async () => {
      const { output } = await generateVocabularyItemData({
        value: 'run',
        context: 'I went for a run this morning before work.',
      });
      console.log('ambiguous-word-with-context-pos', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.partOfSpeech).toBe(PartOfSpeech.Noun);

      await expect(output).toSatisfyStatements([
        'value is "run".',
        'definition describes the noun sense (an act of running / a jog), not the verb sense of moving fast on foot.',
      ]);
    });

    it('uses the context to pick a specific domain sense of an ambiguous word', async () => {
      const { output } = await generateVocabularyItemData({
        value: 'cell',
        context: 'Our biology teacher said every living thing is made of these.',
      });
      console.log('ambiguous-word-with-context-domain', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.partOfSpeech).toBe(PartOfSpeech.Noun);

      await expect(output).toSatisfyStatements([
        'value is "cell".',
        'definition is specifically about the biological unit of a living organism, not a mobile phone, a prison room, or a spreadsheet/battery cell.',
        'uaTranslation is the Ukrainian word for the biological cell ("клітина", case-insensitive), not a prison cell or phone.',
      ]);
    });

    it('falls back to the most common sense when context does not disambiguate', async () => {
      const { output } = await generateVocabularyItemData({
        value: 'bank',
        context: 'no idea what this means, just heard it',
      });
      console.log('unhelpful-context', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.partOfSpeech).toBe(PartOfSpeech.Noun);

      await expect(output).toSatisfyStatements([
        'value is "bank".',
        'definition describes the financial institution sense, not a river bank or any other sense - the most common sense for this word on its own.',
      ]);
    });

    it('corrects a misspelled word', async () => {
      const { output } = await generateVocabularyItemData({ value: 'recieve' });
      console.log('misspelled-word', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.value.toLowerCase()).toBe('receive');
      expect(output.partOfSpeech).toBe(PartOfSpeech.Verb);
    });

    it('corrects a grammar mistake in a short phrase', async () => {
      const { output } = await generateVocabularyItemData({ value: 'a apple' });
      console.log('grammar-mistake-phrase', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.value.toLowerCase()).toBe('an apple');
    });

    it('assigns a part of speech to a fixed multi-word unit', async () => {
      const { output } = await generateVocabularyItemData({ value: 'next to' });
      console.log('fixed-multi-word-unit', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.partOfSpeech).toBe(PartOfSpeech.Preposition);

      await expect(output).toSatisfyStatements([
        'value is "next to".',
        'definition explains it means positioned beside or adjacent to something.',
        'uaTranslation is a single natural Ukrainian equivalent (e.g. "поруч з" or "біля", case-insensitive, or an equally natural single phrase with the same meaning) - not a list of several alternative phrasings.',
      ]);
    });

    it('handles a number value', async () => {
      const { output } = await generateVocabularyItemData({ value: '42' });
      console.log('number-value', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.partOfSpeech).toBe(PartOfSpeech.Number);
      expect(output.value).toBe('forty-two');
      expect(output.definition).toBe('42');

      await expect(output).toSatisfyStatements([
        'uaTranslation is the spelled-out Ukrainian word for forty-two ("сорок два", case-insensitive) - a literal translation, not a joke, cultural reference, or trivia about the number.',
      ]);
    });

    it('corrects and interprets a full idiomatic sentence', async () => {
      const { output } = await generateVocabularyItemData({ value: 'its raining cats and dogs' });
      console.log('idiomatic-sentence', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.value.toLowerCase()).toBe("it's raining cats and dogs");
      expect(output.partOfSpeech).toBeNull();

      await expect(output).toSatisfyStatements([
        'definition explains the idiom means it is raining very heavily, not a literal description of animals falling from the sky.',
        'uaTranslation is a natural Ukrainian idiom or phrase meaning heavy rain, not a literal word-for-word translation of "cats and dogs".',
      ]);
    });

    it('generates a function word entry matching dictionary conventions', async () => {
      const { output } = await generateVocabularyItemData({ value: 'a' });
      console.log('function-word', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.partOfSpeech).toBe(PartOfSpeech.IndefiniteArticle);

      await expect(output).toSatisfyStatements([
        'value is "a".',
        'definition identifies it as the indefinite article and states it is used before a (singular) noun - a bare "indefinite article" with no usage note is not enough.',
        'uaTranslation states that it is the indefinite article in Ukrainian ("неозначений артикль" / "невизначений артикль", case-insensitive) - not a literal word-for-word translation, since the English indefinite article has no standalone Ukrainian equivalent.',
      ]);
    });

    it('generates an infinitive-marker entry with no lexical translation', async () => {
      const { output } = await generateVocabularyItemData({
        value: 'to',
        context: 'I really want to travel this summer.',
      });
      console.log('infinitive-marker', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.partOfSpeech).toBe(PartOfSpeech.InfinitiveMarker);

      await expect(output).toSatisfyStatements([
        'value is "to".',
        'definition identifies it as the infinitive marker/particle used before the base form of a verb.',
        'uaTranslation states that it is the infinitive marker/particle in Ukrainian ("частка інфінітива", case-insensitive, or an equivalent phrase) - not a literal word-for-word translation, since it has no standalone Ukrainian equivalent.',
      ]);
    });

    it('capitalizes a proper noun, matching the dictionary-value convention', async () => {
      const { output } = await generateVocabularyItemData({ value: 'ukraine' });
      console.log('proper-noun', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.value).toBe('Ukraine');
      expect(output.partOfSpeech).toBe(PartOfSpeech.Noun);

      await expect(output).toSatisfyStatements([
        'uaTranslation is the Ukrainian name for the country ("Україна", case-insensitive).',
      ]);
    });

    it('assigns a part of speech to a phrasal verb', async () => {
      const { output } = await generateVocabularyItemData({ value: 'give up' });
      console.log('phrasal-verb', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.partOfSpeech).toBe(PartOfSpeech.Verb);

      await expect(output).toSatisfyStatements([
        'value is "give up".',
        'definition explains it means to stop trying or to quit/surrender, not the literal sense of giving an object upward.',
      ]);
    });

    it('corrects a full sentence that is not an idiom, with no part of speech', async () => {
      const { output } = await generateVocabularyItemData({ value: 'she dont like it' });
      console.log('non-idiom-sentence', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.value.toLowerCase()).toBe("she doesn't like it");
      expect(output.partOfSpeech).toBeNull();

      await expect(output).toSatisfyStatements([
        'definition/uaTranslation are an accurate paraphrase of the corrected sentence (that the subject does not like the object) - reasonable synonymous wording is fine, but not a figurative, idiomatic, or unrelated meaning.',
      ]);
    });

    it('uses the context to avoid a trivia association for an ambiguous word', async () => {
      const { output } = await generateVocabularyItemData({
        value: 'mercury',
        context: 'Old thermometers used to be filled with mercury.',
      });
      console.log('trivia-trap-word', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.partOfSpeech).toBe(PartOfSpeech.Noun);

      await expect(output).toSatisfyStatements([
        'value is "mercury" (lowercase, since it is used as a common noun for the element here, not the planet or the Roman god).',
        'definition describes the silvery liquid metal chemical element, not the planet or the Roman god.',
        'uaTranslation is the Ukrainian word for the chemical element ("ртуть", case-insensitive), not the planet ("Меркурій").',
      ]);
    });

    it('does not capitalize a pronoun into an acronym-like abbreviation', async () => {
      const { output } = await generateVocabularyItemData({ value: 'us' });
      console.log('pronoun-not-acronym', JSON.stringify(output, null, 2));

      assertShape(output);
      expect(output.value).toBe('us');
      expect(output.partOfSpeech).toBe(PartOfSpeech.Pronoun);

      await expect(output).toSatisfyStatements([
        'definition describes the object form of "we" (used as the object of a verb or preposition), not the country abbreviation "US"/"United States".',
        'uaTranslation is the Ukrainian equivalent of the pronoun ("нас"/"нам", case-insensitive), not a translation of "United States".',
      ]);
    });
  });
});
