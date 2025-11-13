import { type Icon } from "@tabler/icons-react";
import * as TablerIcons from "@tabler/icons-react";

/**
 * Resolves an icon component from @tabler/icons-react by name string
 * Returns the default icon if not found
 */
export function resolveIcon(
  iconName: string | undefined,
  defaultIcon: Icon,
): Icon {
  if (!iconName) return defaultIcon;
  
  // Try to get icon from @tabler/icons-react
  const IconComponent = (TablerIcons as Record<string, Icon | undefined>)[iconName];
  
  if (IconComponent && typeof IconComponent === "function") {
    return IconComponent;
  }
  
  return defaultIcon;
}

