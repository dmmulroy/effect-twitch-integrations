import type { IResponseDeserializer } from "../types.js";

export default class DefaultResponseDeserializer
	implements IResponseDeserializer
{
	public async deserialize<TReturnType>(
		response: Response,
	): Promise<TReturnType> {
		const text = await response.text();
		console.log({ text });

		if (text.length > 0) {
			try {
				const json = JSON.parse(text);
				return json as TReturnType;
			} catch (error) {
				console.error("error in deserialize: ", String(error));
				if (error instanceof SyntaxError && response.url.includes("queue")) {
					return {} as TReturnType;
				}
				throw error;
			}
		}

		return null as TReturnType;
	}
}
