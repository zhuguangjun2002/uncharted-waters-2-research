# Storylines

This directory documents how the game's story scripts behave from a
player's point of view: each main character's storyline, and the story script
shared by Guild quests and royal missions. The numbered story script is the matching `SNR*.DAT` and
`SNR*.MES` pair in `raw/`.

Evidence labels used in these notes:

- **Decoded**: directly represented by a known story script route, comparison,
  state change, or dialogue call, or by a cited `MAIN.EXE` routine.
- **Likely**: supported by the program structure or game text, but at least one
  relevant VM operation or executable field has not yet been decoded or named.
- **Unknown**: not established by the current research.

Each guide describes its story from bytecode and executable evidence and ends
with an **Open questions** section listing what remains undecoded.

## Current coverage

| Story script | Content                                | Documentation                                                                                   |
| -----------: | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
|            0 | Common Guild quests and royal missions | [Overview](./common-quests-and-royal-missions.md), [royal mission catalog](./royal-missions.md) |
|            1 | João Franco                            | [Storyline guide](./joao-franco.md)                                                             |
|            2 | Catalina Erantzo                       | [Storyline guide](./catalina-erantzo.md)                                                        |
|            3 | Otto Baynes                            | [Storyline guide](./otto-baynes.md)                                                             |
|            4 | Ernst von Bohr                         | [Storyline guide](./ernst-von-bohr.md)                                                          |
|            5 | Pietro Conti                           | [Storyline guide](./pietro-conti.md)                                                            |
|            6 | Ali Vezas                              | [Storyline guide](./ali-vezas.md)                                                               |

## Primary research sources

- `raw/SNR*.DAT` and `raw/SNR*.MES`: story script programs and their message banks.
- [`dialog-system/scripts/REVERSE_ENGINEERING.md`](../../dialog-system/scripts/REVERSE_ENGINEERING.md):
  VM, save-state, title, and executable evidence.
- `game-details/fame/`: sources and effects of the three Fame values.
- `game-details/friendship.md`: Relation changes made by diplomatic royal
  missions.

## Open questions

None remain.
