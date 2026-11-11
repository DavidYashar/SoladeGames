/** Common word list for the Daily Anagram puzzle (free mode).
 *  Plain, common, dictionary-friendly words — 5 to 8 letters.
 *  MVP list; a licensed dictionary can replace this later. */

export const WORDS: readonly string[] = [
  // 5 letters
  "apple", "beach", "brain", "brave", "brick", "candy", "chair", "cloud",
  "coral", "crane", "crisp", "dance", "dream", "eagle", "earth", "flame",
  "fresh", "fruit", "grape", "green", "happy", "heart", "honey", "horse",
  "house", "juice", "lemon", "light", "magic", "mango", "maple", "medal",
  "money", "music", "night", "ocean", "olive", "paint", "panda", "peace",
  "piano", "pizza", "plane", "plant", "pride", "quiet", "river", "salad",
  "smile", "snake", "solar", "solid", "space", "spark", "spoon", "stone",
  "storm", "sugar", "sunny", "table", "tiger", "toast", "tower", "trail",
  "train", "tulip", "urban", "value", "vivid", "water", "whale", "wheat",
  "world", "zebra",
  // 6 letters
  "autumn", "banana", "basket", "bridge", "breeze", "butter", "candle",
  "castle", "cherry", "circus", "coffee", "cookie", "cotton", "desert",
  "dollar", "dragon", "engine", "falcon", "forest", "fossil", "garden",
  "gentle", "guitar", "hammer", "harbor", "island", "jungle", "kettle",
  "kitten", "ladder", "lantern", "marble", "meadow", "melody", "mirror",
  "nectar", "needle", "orange", "peanut", "pillow", "planet", "pocket",
  "puzzle", "rabbit", "rocket", "saddle", "salmon", "sandal", "silver",
  "sponge", "statue", "stream", "stripe", "sunset", "temple", "thread",
  "timber", "tunnel", "velvet", "violin", "voyage", "walnut", "window",
  "winter", "yellow", "zodiac",
  // 7 letters
  "balance", "bargain", "blossom", "cabinet", "caramel", "chimney",
  "compass", "concert", "cottage", "cricket", "crystal", "diamond",
  "dolphin", "eclipse", "emerald", "feather", "fortune", "gallery",
  "glacier", "harmony", "harvest", "holiday", "horizon", "library",
  "mystery", "natural", "orchard", "oxygen", "package", "passion",
  "pattern", "picture", "popcorn", "rainbow", "science", "seagull",
  "success", "sweater", "thunder", "tornado", "tractor", "traffic",
  "triumph", "trumpet", "victory", "village", "volcano", "weather",
  "whisper", "wonder",
  // 8 letters
  "alphabet", "avocado", "baseball", "broccoli", "building", "butterfly",
  "calendar", "carnival", "champion", "cheerful", "chocolate", "decorate",
  "delivery", "dinosaur", "elephant", "engineer", "festival", "football",
  "fountain", "friendly", "generous", "gratitude", "guardian", "handshake",
  "keyboard", "language", "laughter", "learning", "magnetic", "mountain",
  "notebook", "paradise", "particle", "patience", "painting", "peaceful",
  "pendulum", "platform", "sandwich", "sapphire", "seashell", "sentence",
  "skeleton", "snowball", "solution", "souvenir", "spectrum", "squirrel",
  "sunlight", "surprise", "symmetry", "teamwork", "treasure", "triangle",
  "universe", "vacation", "workshop",
] as const;
