const classes = [
  "",
  "text-green-600 dark:text-green-400",
  "text-lime-600 dark:text-lime-400",
  "text-yellow-600 dark:text-yellow-400",
  "text-orange-600 dark:text-orange-400",
  "text-red-600 dark:text-red-400",
];

export function difficultyClass(difficulty: number | undefined): string {
  return classes[difficulty ?? 0] ?? "";
}
