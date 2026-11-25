## 2026-11-24

### Upstream merge: 规程·序列Ⅰ (Regulation · Sequence I)

- Merged upstream 0.4.0 work (`master`) at [`55f528e9`](https://github.com/sganggs/Stronghold-Protocol/commit/55f528e9fc4872388360ee85e13eca8594856204), bringing in the CN-only season 规程·序列Ⅰ (`act3autochess@V3_1`): its laddered solo modes (Rapid Simulation, Regulation Levels 1–20), Commands, the 5-slot equipment row, 选择自编 (Choose Custom Squad), bond groups, its opening film, season music and themes. Fork-side decisions:
  - Every fork feature stays: Grand Alliance rooms (squads, password, One for All), the core-bond call, match and room chat, outfits and outfit voices, official skill triggers, animated illustrations, preload, the fit-to-width bond strip and the always-on damage meter.
  - Upstream's start-up default is kept: the title and lobby open on 规程 (`LOBBY_DEFAULT_VERSION`); a host can pin another version with `SP_VERSION_DEFAULT`.
  - The Grand Alliance's `entry` prop of the protocol picker is renamed from `modeId`, which upstream now uses for the laddered official modes.
  - Upstream's 下载资源管理 (resource manager) is in the tree but not on the fork's title screen; the fork's preload stays the download path.

### English for 规程·序列Ⅰ

- The new season is in English: 90 % of its texts come from the official EN tables (operators, skills, enemies, items shared with released content), the rest (alliances, strategies, Stronghold Abilities, equipment, the new OpFor leaders, Commands) from a community dictionary written for this fork, `tools/i18n/dict-en.act3autochess-v3_1.json`. No official EN exists for this season: these names are unofficial and will change when Yostar's arrive.

### Nymph's 规程 ability adds Swift stacks again

- In 规程, Nymph's ability now adds [Swift] stacks whenever an enemy in her range is Feared (+4 / +8, up to 20 / 40 a battle).
- Before (upstream 0.4.0): it watched for Frozen instead, so it never added stacks.

### 规程 playtest fixes (2026-11-25)

- Mutant Sand Beasts and Mutant Rock Spiders (and their α) now split into 2 / 3 Originiutant Excrescences (α: Tumors) when defeated, as the Giant Rock Spider already did. Before (upstream 0.4.0): they split into nothing.
- Focused / Prism Soul Remnants and Infused / Penumbral Soul Husks now pick up Soul Maelstroms that come within 0.25 tiles (up to 3; the Maelstrom leaves the field, no kill and no lost LP). With charges, a Remnant spends them all on a 7.8 s beam along its target's row or column: 40 % ATK Arts damage a second to every operator in a 0.65-wide line, its ATK rising 40 % a second up to +25 % per charge (Prism: 50 %, +200 %, +40 %) [src: PRTS 聚焦魂灵残迹 §天赋与能力; official enemy_database Laser blackboard]. A Husk spends one charge per orbiting fragment. Before (upstream 0.4.0): no pickup, so the Remnant never fired and the Husk summoned fragments for free.
- Defeated Infused Glacial Originium Slug α and 'Jet' / 'Boom Canisters' now chill the operators around them (10 s Cold) [src: official enemy_database boom.freeze / Boom.freeze; PRTS “喷射罐” §天赋与能力]. Before (upstream 0.4.0): no effect (the Canisters had no blast at all).
- An Icefield Arts Fighter / Guard's blast now comes 1.2 s after it is defeated, reaches 1.65 tiles and applies 5 s of Cold to operators and other enemies [src: PRTS 冰原卫法者 §天赋与能力]; a second Cold during it freezes as usual. Before (upstream 0.4.0): it froze every operator in reach at once.
- The bond strip keeps the same number of bonds before its +N button through the match. Before: in the 规程 layout it could drop to one or two bonds and fewer each round, because it measured a row whose width followed what it already showed.
- A Command switched mid-match (with the dice item) is described in the player's language. Before: in Chinese.
- 规程 texts say "defeated" where they said "knocked down" (the official EN wording for 被击倒).

### 规程 playtest fixes, part 2 (2026-11-25)

- Roberta's Full-Auto Modeler and Ebenholz's Old Day Remnants can no longer be targeted or damaged (Originium tiles, enemy effects). Before: Originium tiles and enemy effects that ignore targeting wore them down, and enemies could target the Remnants [src: PRTS 旧日残影 §属性 (装置); David's playtest].
- Bestial Hou (Bestial Ju's companion) stays visible while it walks. Before: its walk animation has no length, so it was drawn in an empty pose and vanished whenever it moved.
- Treasure Hunter's Simulated Treasure keeps its chest model during combat. Before: it turned into the generic device box when the battle began.

### Official effects come with the release art

- `npm run assets:release-local` now also installs `data/local-fx.json`, the file list of the official battle effects, when the release zip has one (v0.4.0 does). Before: the effects' files arrived but were never served, so the board drew the game's own effects and the "Official Effects" setting stayed hidden.

Kind: player

Server cost: none

Operator notes:

- Re-run `npm run assets:release-local` once to get `data/local-fx.json` (the official effects), then turn on Settings → Official Effects.
- Grand Alliance needs the server started with `SP_LARGE_ROOMS=1`, and is offered on Season 2 only (unchanged from the fork).
- After pulling, rebuild the unit art the merge touched on a machine with the art (`node tools/fetch-assets.mjs --offline --add-only --refresh-units=<list from npm run merge:generated>`, then `npm run merge:generated -- --rebuilt`).
