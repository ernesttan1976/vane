import { DspyFunctionDefinition } from './types';
import morphologyMatrixDefinition from './templates/morphologyMatrix';

class DspyFunctionRegistry {
  private static functions: Map<string, DspyFunctionDefinition> = new Map();

  static register(definition: DspyFunctionDefinition) {
    this.functions.set(definition.name, definition);
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
}

DspyFunctionRegistry.register(morphologyMatrixDefinition);

export default DspyFunctionRegistry;
