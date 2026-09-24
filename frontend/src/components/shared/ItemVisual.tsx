import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AppstoreOutlined } from '@ant-design/icons';
import type { SelectProps } from 'antd';
import type { Machine, Recipe, StockImageMap } from '../../types';
import { OCCUPATION_IMAGE } from './OccupationSelect';

interface Visual { name: string; image?: string }
const VisualContext = createContext<Record<string, Visual>>({});

export function ItemVisualProvider({ recipes, machines, stockImages, children }: {
  recipes: Recipe[]; machines: Machine[]; stockImages: StockImageMap; children: ReactNode;
}) {
  const catalog = useMemo(() => {
    const result: Record<string, Visual> = Object.create(null);
    for (const [id, image] of Object.entries(OCCUPATION_IMAGE)) result[id] = { name: id, image };
    for (const machine of machines) result[machine.machine_id] = { name: machine.machine_name, image: machine.image };
    for (const recipe of recipes) result[recipe.id] = { name: recipe.name, image: recipe.image };
    for (const [id, image] of Object.entries(stockImages)) {
      if (image) result[id] = { name: result[id]?.name ?? id, image };
    }
    return result;
  }, [recipes, machines, stockImages]);
  return <VisualContext.Provider value={catalog}>{children}</VisualContext.Provider>;
}

export function useItemImage(id: string) {
  return useContext(VisualContext)[id]?.image;
}

/** Decorative thumbnail: its adjacent label supplies the accessible name. */
export function ItemThumbnail({ id, image, size = 32 }: { id?: string; image?: string; size?: number }) {
  const catalog = useContext(VisualContext);
  const src = image || (id ? catalog[id]?.image : undefined);
  const [failedSrc, setFailedSrc] = useState<string>();
  return <span className="item-thumbnail" style={{ width: size, height: size }} aria-hidden="true">
    {src && src !== failedSrc
      ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailedSrc(src)} />
      : <AppstoreOutlined className="item-thumbnail__fallback" />}
  </span>;
}

export function ItemLabel({ id, name, image, size = 28, detail, reserveImage = false }: {
  id?: string; name?: ReactNode; image?: string; size?: number; detail?: ReactNode; reserveImage?: boolean;
}) {
  const catalog = useContext(VisualContext);
  const label = name ?? (id ? catalog[id]?.name ?? id : '');
  return <span className="item-label">
    {(reserveImage || image || (id && catalog[id]?.image)) && <ItemThumbnail id={id} image={image} size={size} />}
    <span className="item-label__copy"><span className="item-label__name" title={typeof label === 'string' ? label : undefined}>{label}</span>
      {detail && <span className="item-label__detail">{detail}</span>}
    </span>
  </span>;
}

// Keep option.label as plain text so searching and accessible labels still work.
export const itemSelectVisuals: Pick<SelectProps, 'optionRender' | 'labelRender'> = {
  optionRender: (option) => <ItemLabel id={String(option.value ?? '')} name={option.label} size={28} />,
  labelRender: ({ value, label }) => <ItemLabel id={String(value ?? '')} name={label} size={22} />,
};
