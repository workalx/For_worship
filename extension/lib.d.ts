export {};

declare global {
  // eslint-disable-next-line no-var
  var ForWorshipExt: {
    MESSAGE_TYPE: 'for-worship/songselect-import';
    VERSION: 1;
    RESULT_TYPE: 'for-worship/songselect-result';
    isResultMessage(data: unknown): boolean;
    APP_ORIGINS: string[];
    songNumberFromUrl(url: string): string | null;
    isChordSheetUrl(url: string): boolean;
    chordsHtmlUrl(songNumber: string, key: string): string;
    buildImportMessage(
      html: string,
      pageUrl: string,
      ccliNumber: string,
    ): { type: 'for-worship/songselect-import'; version: 1; html: string; pageUrl: string; ccliNumber: string };
  };
}
