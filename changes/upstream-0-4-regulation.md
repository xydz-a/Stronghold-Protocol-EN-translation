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

### Grand Alliance on Season 3, and the item effect tooltips (2026-11-25)

- Grand Alliance rooms can now be created on any official season, Regulation · Sequence I included (still only when the server runs with `SP_LARGE_ROOMS=1`). The room browser names a room's season when it isn't Season 2. Before: Season 2 only; a room created from the Season 3 lobby could not start.
- A Season 3 Grand Alliance plays with squads and the scaled pool: the options now reach the separate process that runs another season's matches. An 8-seat all-AI Season 3 match plays to its end with no engine error [src: test/match/version-host.test.js (g)].
- Outfits for the operators Season 3 added (40 more, 347 in all) and their Elite 2 artwork; the wide room card now frames that artwork instead of zooming into the half-body portrait. Their outfit names still show in Chinese until the English overlay is rebuilt.
- The effects column's tooltip for an item with a lasting effect (Budget-Savvy Doll) is in the player's language. Before: always in Chinese, in every season.

### 规程 playtest fixes, part 3 (2026-11-26)

- Mitm's placed Cherry-3 is her only car: it leaves the wreckage when defeated, and the replacement car comes back on the tile where it was placed. Before: a second car appeared next to her, and only that second car left wreckage or came back.
- Touch of the Sanguinarch, Gift of the Sanguinarch, Touch of Benevolence and Gift of Magnanimity take 90% less physical and arts damage. The unit blocking them gets +1 block per one it blocks, up to 6. Before: they had neither [src: enemies.json talents dmg_res / buff_to_blocker].
- Enemies that appear when another one is defeated (the Sanguinarch spawns from Sarkaz Heirbearers, split children, the Parasite's gift) cost LP when they leak. They still don't count toward the wave's enemy total. Before: they leaked for free.

### 规程 playtest fixes, part 4 (2026-11-26)

- Arcane at 3 operators strips stealth from every enemy inside an Arcane operator's attack range, for as long as it stays there. Before: only a stealth that started inside a range was removed, so enemies that walked in already stealthed stayed hidden.
- Bestial Hou stays in the middle of the field instead of walking the route. Its Time Shift buffs are gone with the movement they depended on [src: David's playtest].
- Bestial Ju's extra blast when it gets blocked fires once per block. Before: it repeated every 2 s for as long as it stayed blocked, a 2× ATK area on top of its trample, which wiped most lineups [src: enemies.json enemy_2124_dyjsfg CombatAoe cooldown, combat_atk_scale].
- Light / Heavy Rapid Crossbowmen fire their Straight Strike: 3 bolts at the first unit in their row or column, at any distance. Before: they had no ability, and with no range they never attacked [src: BWIKI 速射劲弩手].
- Mateo's Guard's two bombs reach the first unit in line at any distance and blast a 1.1 radius around it. Before: the blast radius was read as its reach, so it fired only at units within 1.1 tiles [src: BWIKI 马特奥的近卫].
- The Impetuous Grenadier throws one bomb down each of the four directions the first time it is hit while unblocked (200% ATK, 1.1 radius), then speeds up and loses 2 weight. Before: it had no ability.
- Sarkaz Heirbearer Bombardiers / Annihilators fire delayed shells. Each attack lands where its target stands and explodes 4 s later, dealing the attack's physical damage within 1.1 tiles. Before: an ordinary ranged hit [src: BWIKI 萨卡兹子裔毁击者].
- Divicellular Hoarders split once below half HP: one copy at the same HP ratio, which does not split again [src: BWIKI 异光体集养者].
- Jessica the Liberated casts her S3 once an enemy is within its range, as she already did in the other seasons. Season 3's data triggers it only when she takes damage, and her taunting Mobile Shield takes most hits, so she cast it seemingly at random (a deliberate change from the official trigger).

### 规程 playtest fixes, part 5 (2026-11-27)

- Raging Direswines and Bounty Hunter 'Knight's speed up as they walk. The Direswine gains +33.3% every 0.333 s, up to 35 times, after a 3 s wind-up; the Knight gains +50% every 0.5 s, up to 25 times. A stun or a bind clears it. Their first hit on a blocker adds damage scaled by their speed, physical for the Direswine and arts for the Knight. The Direswine also damages each unit it runs over, and only a unit with 2 block can stop it. Before: neither had any ability [src: BWIKI 狂暴凶豕兽, 赏金猎人“大骑士”].
- Brave Palladulis charges the nearest unit in its row or column every 10 s (first at 5 s) while unblocked. It can't be blocked during the charge and deals 200% ATK on contact. Before: no ability [src: Arknights Terra Wiki, Palladulis].
- The 'Catapult' and 'Mortar' throw their snowball: the first attack reaches 2.5 tiles and hits the target and the four tiles around it for 150% ATK. After that they only fight what blocks them. Before: their range was 0, so the throw never happened [src: BWIKI “投石机”].

### 规程 playtest fixes, part 6 (2026-11-27): an audit of enemy abilities

Every Season 3 enemy whose handbook lists an ability was checked for code behind it. These had none and now act:
- Skybuster Soda speeds up as it walks (+30% every 0.5 s, up to 25 times) and loses HP as it goes [src: enemies.json enemy_10146_nscola Passive; David 2026-11-27].
- Dazzling Blade Chef: ground enemies around it gain attack speed and arts resistance [src: its talent].
- Witch King's / Remnant Orchestra Drummer: it attacks from range, and every third attack hits every unit in range. The Hornist's third attack hits a second target. Silence stops both.
- Yeti Operative: more damage against frozen targets.
- Bloodboil Knightclub Elite: stronger each time another enemy falls, up to 10 times.
- Blade Helmet Knightclub Trainee: weakens your strongest unit and revives once.
- Sarkaz Heirbearer ASV: Sanguinarch spawns gain ATK and add Apoptosis while it lives.
- Caustic Originium Slug: explodes on death.
- Toxocellular Drifter: adds Nervous Impairment and targets units on high ground first.
- Windlistener Hunter: blinks next to whoever hits it.
- Mockup Auto Meal Distributor: summons a helper every 5 s [src: enemies.json enemy_10077_mpbarr Spawn cooldown].
- Flying Toaster: damages units around it while unblocked.
- Exocellular Depositor: draws attacks. Its shell is still left out.
- Bloodborn Spawn: heals from its hits, hits harder against units that block more enemies, and leaves a Blood Amber.
- The straight-line shooters (crossbowmen, Mateo's Guard, the Grenadier) stop to fire, like the Heavy Crossbowman Ambusher.
- Not done: abilities tied to event-only mechanics (the Miner Guerrillas, power armor, chains, heaters, music modes), the Raging Man Eater's devour, the Fortbreaker's missiles and the Desperate Breadwinner's aura.

Also:
- Touch's Field Medic appears in battle on every player's field. Before: when an AI or another player took Touch, the others saw the medic in preparation but not in battle.

### Official effects come with the release art

- `npm run assets:release-local` now also installs `data/local-fx.json`, the file list of the official battle effects, when the release zip has one (v0.4.0 does). Before: the effects' files arrived but were never served, so the board drew the game's own effects and the "Official Effects" setting stayed hidden.

Kind: player

Server cost: none

Operator notes:

- Re-run `npm run assets:release-local` once to get `data/local-fx.json` (the official effects), then turn on Settings → Official Effects.
- Grand Alliance needs the server started with `SP_LARGE_ROOMS=1` (unchanged from the fork); it is now offered on every season.
- After pulling, rebuild the unit art the merge touched on a machine with the art (`node tools/fetch-assets.mjs --offline --add-only --refresh-units=<list from npm run merge:generated>`, then `npm run merge:generated -- --rebuilt`).
