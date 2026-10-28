import type {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";

// Express 4 no captura los errores de handlers async. Sin este
// envoltorio, un error dentro de un handler async puede tumbar el
// proceso. Aquí siempre se reenvía al manejador de errores.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
