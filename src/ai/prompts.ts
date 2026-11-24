const FORMAT = `Return ONLY JSON, no explanations.
Each song object: {"title": string, "artist"?: string, "key"?: string, "bpm"?: number, "body": string, "source"?: string}.
"body" is the full song in ChordPro: chords in square brackets right before the syllable they are played on, e.g. "[G]Ти світло в [D]темряві".
Put section labels on their own line in the song's language, e.g. "Куплет 1", "Приспів", "Брідж", "Куплет 2", "Припев", "Verse 1", "Chorus", "Bridge".
Keep lyrics in the original language (Ukrainian, Russian or English); never translate. Use B (not H) for the note B.
"key" is the key the chords are written in (e.g. "G", "Am"). Never invent chords: if a page has no chords, skip it.`;

export function photoPrompt(): string {
  return `The image is a photo of a song sheet or screen with lyrics and guitar chords (chords are usually written above the lyrics).
Recognize the song. Place each chord before the exact syllable it stands above. Return ONE JSON object (not an array).
If there are no lyrics in the image, return {}.
${FORMAT}`;
}
