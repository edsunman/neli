import { createContext } from 'svelte';

type KeyframeContext = {
	params: number[] | undefined;
	active: () => boolean;
};

export const [getKeyframeContext, setKeyframeContext] = createContext<KeyframeContext>();
