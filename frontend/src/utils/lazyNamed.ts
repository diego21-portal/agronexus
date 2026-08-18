import { lazy, type ComponentType } from "react";

export function lazyNamed<
  TModule,
  TKey extends keyof TModule,
>(
  importer:
    () => Promise<TModule>,

  name: TKey
) {
  return lazy(
    async () => {
      const module =
        await importer();

      return {
        default:
          module[
            name
          ] as ComponentType,
      };
    }
  );
}