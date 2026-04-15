import { DspyFunctionDefinition } from './types';
import morphologyMatrixDefinition from './templates/morphologyMatrix';
import DspyManager from './manager';

class DspyFunctionRegistry {
  private static functions: Map<string, DspyFunctionDefinition> = new Map();
  private static hydratedFromDb = false;
  private static hydratePromise: Promise<void> | null = null;

  static register(definition: DspyFunctionDefinition) {
    this.functions.set(definition.name, definition);
  }

  static async hydrateFromDb() {
    if (this.hydratedFromDb) return;

    if (!this.hydratePromise) {
      this.hydratePromise = (async () => {
        const persistedFunctions = await DspyManager.listPersistedFunctions();
        persistedFunctions.forEach((record) => {
          this.register(DspyManager.compileDefinition(record));
        });
        this.hydratedFromDb = true;
      })();
    }

    await this.hydratePromise;
  }

  static clearPersistedRegistrations() {
    this.functions.clear();
    this.hydratedFromDb = false;
    this.hydratePromise = null;
    this.register(morphologyMatrixDefinition);
  }

  static get(name: string) {
    return this.functions.get(name);
  }

  static list() {
    return Array.from(this.functions.values()).map((fn) => ({
      name: fn.name,
      description: fn.description,
      category: fn.category,
    }));
  }

  static listDefinitions() {
    return Array.from(this.functions.values());
  }
}

DspyFunctionRegistry.register(morphologyMatrixDefinition);

export default DspyFunctionRegistry;
