export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export function dayPeriod(now = new Date()): DayPeriod {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export function emptyStateHeading(now = new Date()): string {
  switch (dayPeriod(now)) {
    case 'morning':
      return 'Morning. Ready when you are.';
    case 'afternoon':
      return 'Good afternoon.';
    case 'evening':
      return 'Evening. What should we work on?';
    case 'night':
      return 'Moonlit chat?';
  }
}

export function timeAwareGreeting(now = new Date()): string {
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  return `Hi! It's ${weekday} ${dayPeriod(now)} — what can I help you with?`;
}
