import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  readMarcaConfig,
  saveMarcaConfig,
  type MarcaConfig,
} from "./marca-cerebro.server";

export const getMarcaConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<MarcaConfig> => {
    return await readMarcaConfig();
  },
);

const Input = z.object({
  publico: z.string().max(8000).optional(),
  dores: z.string().max(8000).optional(),
  objecoes: z.string().max(8000).optional(),
  tom: z.string().max(8000).optional(),
  frases: z.string().max(8000).optional(),
  regras: z.string().max(8000).optional(),
  extra: z.string().max(20000).optional(),
});

export const salvarMarcaConfig = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input ?? {}))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const config: MarcaConfig = {
      publico: (data.publico ?? "").toString(),
      dores: (data.dores ?? "").toString(),
      objecoes: (data.objecoes ?? "").toString(),
      tom: (data.tom ?? "").toString(),
      frases: (data.frases ?? "").toString(),
      regras: (data.regras ?? "").toString(),
      extra: (data.extra ?? "").toString(),
    };
    await saveMarcaConfig(config);
    return { ok: true };
  });
