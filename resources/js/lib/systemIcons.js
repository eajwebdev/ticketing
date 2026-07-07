import {
  WashingMachine, UtensilsCrossed, Store, Pill, Boxes, Monitor, Truck, Building2,
  ShoppingCart, CreditCard, Stethoscope, Coffee, Scissors, Wrench, GraduationCap,
  Warehouse, Hotel, Car, Dumbbell, Users, Droplets, LayoutGrid,
} from 'lucide-react';

/**
 * Curated icon set for EAJ systems — shared by the landing page,
 * the admin Systems editor, and anywhere a system icon renders.
 */
export const SYSTEM_ICONS = {
  WashingMachine,
  UtensilsCrossed,
  Store,
  Pill,
  Boxes,
  Monitor,
  Truck,
  Building2,
  ShoppingCart,
  CreditCard,
  Stethoscope,
  Coffee,
  Scissors,
  Wrench,
  GraduationCap,
  Warehouse,
  Hotel,
  Car,
  Dumbbell,
  Users,
  Droplets,
};

export const FALLBACK_ICON = LayoutGrid;

export function systemIcon(name) {
  return SYSTEM_ICONS[name] ?? FALLBACK_ICON;
}
