import { toast as sonnerToast } from "sonner";

import { genericActionError, userFacingErrorMessage } from "@/lib/ui/user-facing-error";

function safeToastArguments(args: unknown[]) {
  return args.map((argument) => {
    if (typeof argument === "string" || argument instanceof Error) {
      return userFacingErrorMessage(argument, genericActionError);
    }
    if (argument && typeof argument === "object" && "description" in argument) {
      const options = argument as { description?: unknown } & Record<string, unknown>;
      if (typeof options.description === "string" || options.description instanceof Error) {
        return {
          ...options,
          description: userFacingErrorMessage(options.description, genericActionError),
        };
      }
    }
    return argument;
  });
}

/** Sonner-compatible toast facade that redacts accidental database and stack details. */
const safeToast = new Proxy(sonnerToast, {
  apply(target, thisArgument, argumentsList) {
    return Reflect.apply(target, thisArgument, safeToastArguments(argumentsList));
  },
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    if (typeof value !== "function") return value;
    return (...args: unknown[]) => Reflect.apply(value, target, safeToastArguments(args));
  },
});

export { safeToast as toast };
