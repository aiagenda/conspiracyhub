/**
 * Duplicate investigations consolidated onto the URL Google already shows.
 * Keys are old slugs; values are the single public slug.
 */
export const ARTICLE_CANONICAL_SLUG: Record<string, string> = {
  // Adrenochrome — impression leader (position ~9).
  "debunking-adrenochrome-conspiracy-analysis-mse96rgu": "adrenochrome-conspiracy-myths-realities-mt7gqorv",
  "adrenochrome-conspiracy-myths-realities-mr0k7yo3": "adrenochrome-conspiracy-myths-realities-mt7gqorv",
  "debunking-adrenochrome-conspiracy-mqkl89fw": "adrenochrome-conspiracy-myths-realities-mt7gqorv",
  "adrenochrome-conspiracy-disinformation-mrxg6uj0": "adrenochrome-conspiracy-myths-realities-mt7gqorv",
  "debunking-adrenochrome-conspiracy-theory-mpcl6o6d": "adrenochrome-conspiracy-myths-realities-mt7gqorv",
  // MKULTRA
  "cia-mkultra-declassified-documents-mv0yl1nt": "cia-mkultra-declassified-documents-mszoxzk6",
  "cia-mkultra-declassified-documents-reveal-mtjpun9b": "cia-mkultra-declassified-documents-mszoxzk6",
  "cia-mkultra-declassified-documents-msflpd5p": "cia-mkultra-declassified-documents-mszoxzk6",
  "cia-mkultra-declassified-documents-reveal-mptkdb8k": "cia-mkultra-declassified-documents-mszoxzk6",
  "cia-mkultra-declassified-documents-mpass2wq": "cia-mkultra-declassified-documents-mszoxzk6",
  "unveiling-mkultra-declassified-fbi-files-impact-mp9j1edj": "cia-mkultra-declassified-documents-mszoxzk6",
  // PRISM — the URL search referrers actually land on.
  "project-prism-mass-surveillance-snowden-revelations-mqzaaict": "project-prism-mass-surveillance-snowden-revelations-mp9j1p75",
  "project-prism-mass-surveillance-snowden-documents-mqf49pqv": "project-prism-mass-surveillance-snowden-revelations-mp9j1p75",
  // CIA reading room — the URL with a Search Console click.
  "cia-electronic-reading-room-impact-mv5750qy": "cia-electronic-reading-room-secrets-mr1uh1fx",
  "cia-electronic-reading-room-secrets-mr7z37k9": "cia-electronic-reading-room-secrets-mr1uh1fx",
  "cia-electronic-reading-room-secrets-mq7r5ppm": "cia-electronic-reading-room-secrets-mr1uh1fx",
  "cia-electronic-reading-room-secrets-mpk6utth": "cia-electronic-reading-room-secrets-mr1uh1fx",
  // Echelon
  "echelon-global-surveillance-network-mv5750eg": "echelon-global-surveillance-network-mt88385k",
  "echelon-global-surveillance-network-mp8b2b7f": "echelon-global-surveillance-network-mt88385k",
  // OpenAI influencer
  "openai-influencer-strategy-controversy-mv574wtl": "openai-influencer-strategy-ethical-dilemma-mu0zg27h",
  "openai-influencer-strategy-controversy-mse90vbr": "openai-influencer-strategy-ethical-dilemma-mu0zg27h",
  // Operation Paperclip
  "operation-paperclip-ethical-dilemmas-mryx00o7": "operation-paperclip-us-recruitment-nazi-scientists-mpmijrlt",
  "operation-paperclip-us-recruitment-nazi-scientists-mrkajwkh": "operation-paperclip-us-recruitment-nazi-scientists-mpmijrlt",
  "operation-paperclip-us-recruitment-nazi-scientists-mr1ugvxw": "operation-paperclip-us-recruitment-nazi-scientists-mpmijrlt",
  "operation-paperclip-ethical-concerns-mqzaaico": "operation-paperclip-us-recruitment-nazi-scientists-mpmijrlt",
  "operation-paperclip-ethical-dilemmas-mpxob4z9": "operation-paperclip-us-recruitment-nazi-scientists-mpmijrlt",
  // Operation Northwoods
  "operation-northwoods-false-flag-plan-mrywzzve": "operation-northwoods-false-flag-plan-mp5mb5ax",
  "operation-northwoods-false-flag-plan-jfk-mq6ktm2e": "operation-northwoods-false-flag-plan-mp5mb5ax",
  "operation-northwoods-false-flag-plan-jfk-mp5ofqeq": "operation-northwoods-false-flag-plan-mp5mb5ax",
  // Operation Mockingbird
  "operation-mockingbird-cia-media-infiltration-mrxg6wsx": "operation-mockingbird-cia-media-infiltration-mpus34fb",
  "operation-mockingbird-cia-media-infiltration-mq944hw8": "operation-mockingbird-cia-media-infiltration-mpus34fb",
};

export function canonicalArticleSlug(slug: string): string | null {
  const target = ARTICLE_CANONICAL_SLUG[slug];
  return target && target !== slug ? target : null;
}
