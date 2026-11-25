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

Kind: player

Server cost: none

Operator notes:

- After pulling, rebuild the unit art the merge touched on a machine with the art (`node tools/fetch-assets.mjs --offline --add-only --refresh-units=<list from npm run merge:generated>`, then `npm run merge:generated -- --rebuilt`).
