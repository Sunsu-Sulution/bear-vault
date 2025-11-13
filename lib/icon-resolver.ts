import { type Icon } from "@tabler/icons-react";
import {
  IconHome,
  IconFolder,
  IconGitBranch,
  IconLink,
  IconDatabase,
  IconChartBar,
  IconTable,
  IconFileText,
  IconUsers,
  IconMail,
  IconBell,
  IconSearch,
  IconCalendar,
  IconClock,
  IconSettings,
  IconStar,
  IconHeart,
  IconBookmark,
  IconTag,
  IconFlag,
} from "@tabler/icons-react";

// Map of icon names to icon components
const ICON_MAP: Record<string, Icon> = {
  IconHome,
  IconFolder,
  IconGitBranch,
  IconLink,
  IconDatabase,
  IconChartBar,
  IconTable,
  IconFileText,
  IconUsers,
  IconMail,
  IconBell,
  IconSearch,
  IconCalendar,
  IconClock,
  IconSettings,
  IconStar,
  IconHeart,
  IconBookmark,
  IconTag,
  IconFlag,
};

/**
 * Resolves an icon component from @tabler/icons-react by name string
 * Returns the default icon if not found
 */
export function resolveIcon(
  iconName: string | undefined,
  defaultIcon: Icon,
): Icon {
  if (!iconName) return defaultIcon;

  // Try to get icon from the map
  const IconComponent = ICON_MAP[iconName];

  // Check if IconComponent exists and is a valid React component
  // React components can be functions or forwardRef objects
  if (IconComponent && (typeof IconComponent === "function" || (typeof IconComponent === "object" && IconComponent !== null && "render" in IconComponent))) {
    return IconComponent;
  }

  // Debug: log if icon not found
  if (process.env.NODE_ENV === "development") {
    console.warn(`Icon "${iconName}" not found in ICON_MAP. Available icons:`, Object.keys(ICON_MAP));
  }

  return defaultIcon;
}

