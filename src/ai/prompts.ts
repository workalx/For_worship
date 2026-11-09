const FORMAT = `Return ONLY JSON, no explanations.
Each song object: {"title": string, "artist"?: string, "key"?: string, "bpm"?: number, "body": string, "source"?: string}.
"body" is the full song in ChordPro: chords in square brackets right before the syllable they are played on, e.g. "[G]Ти світло в [D]темряві".
Put section labels on their own line in the song's language, e.g. "Куплет 1", "Приспів", "Брідж", "Куплет 2", "Припев", "Verse 1", "Chorus", "Bridge".
Keep lyrics in the original language (Ukrainian, Russian or English); never translate. Use B (not H) for the note B.
"key" is the key the chords are written in (e.g. "G", "Am"). Never invent chords: if a page has no chords, skip it.`;

export function searchPrompt(query: string): string {
  return `Find the worship song "${query}" with lyrics and guitar chords on chord websites (Ukrainian, Russian or English songs).
Read the actual song pages. Return a JSON array with up to 3 different versions (different sites or arrangements), best match first.
Set "source" to the page URL. If nothing with chords is found, return [].
${FORMAT}`;
}

export function urlPrompt(url: string): string {
  return `Read this page: ${url}
It contains a song with lyrics and guitar chords. Extract the song and return a JSON array with exactly one song object, "source" = the URL.
If the page has no song with chords, return [].
${FORMAT}`;
}

export function photoPrompt(): string {
  return `The image is a photo of a song sheet or screen with lyrics and guitar chords (chords are usually written above the lyrics).
Recognize the song. Place each chord before the exact syllable it stands above. Return ONE JSON object (not an array).
If there are no lyrics in the image, return {}.
${FORMAT}`;
}
