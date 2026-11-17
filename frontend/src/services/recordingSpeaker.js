export const speakerDeclarations = Object.freeze([
  { value: 'self', text: '本人发声并同意' },
  { value: 'speaker_oral', text: '帮他人录，发声人已口头同意' },
  { value: 'speaker_written', text: '帮他人录，发声人已书面同意' },
]);

export function declarationLabel(value) {
  return speakerDeclarations.find((item) => item.value === value)?.text || '未记录';
}
