/**
 * shared/OccupationSelect.tsx
 *
 * Reusable AntD Select for occupation with avatar icons.
 * Shows the image both in the dropdown list AND in the selected value.
 */
import { Select, Avatar, Space } from 'antd';
import type { SelectProps } from 'antd';

export type Occupation = 'วิศวะกร' | 'หมอ' | 'เชฟ' | 'ไอดอล' | 'เกษตร' | 'ทุกอาชีพ';

export const OCCUPATIONS: Occupation[] = ['วิศวะกร', 'หมอ', 'เชฟ', 'ไอดอล', 'เกษตร', 'ทุกอาชีพ'];

export const OCCUPATION_IMAGE: Record<Occupation, string> = {
  วิศวะกร: '/occupations/engineer.png',
  หมอ:      '/occupations/doctor.png',
  เชฟ:      '/occupations/chef.png',
  ไอดอล:   '/occupations/idol.png',
  เกษตร:   '/occupations/farmer.png',
  ทุกอาชีพ: '',
};

export const OCCUPATION_COLOR: Record<Occupation, string> = {
  วิศวะกร: 'blue',
  หมอ:      'green',
  เชฟ:      'orange',
  ไอดอล:   'pink',
  เกษตร:   'lime',
  ทุกอาชีพ: 'purple',
};

/** Option row — used both in dropdown list and as selected label */
function OccupationLabel({ occ }: { occ: Occupation }) {
  return (
    <Space size={6} style={{ alignItems: 'center' }}>
      <Avatar
        src={OCCUPATION_IMAGE[occ]}
        size={18}
        style={{ flexShrink: 0, background: '#f1f5f9' }}
      >∀</Avatar>
      <span>{occ}</span>
    </Space>
  );
}

// Build options array once
const OCC_OPTIONS = OCCUPATIONS.map((occ) => ({
  label: <OccupationLabel occ={occ} />,
  value: occ,
  // plain text for search/filter
  title: occ,
}));

interface OccupationSelectProps extends Omit<SelectProps, 'options' | 'optionRender'> {
  /** If true, adds a "ทั้งหมด" option at the top (value: '') */
  includeAll?: boolean;
}

export function OccupationSelect({ includeAll, ...props }: OccupationSelectProps) {
  const options = includeAll
    ? [
        {
          label: (
            <Space size={6} style={{ alignItems: 'center' }}>
              <Avatar size={18} style={{ background: '#e2e8f0', color: '#64748b', fontSize: 11 }}>
                ∀
              </Avatar>
              <span>ทั้งหมด</span>
            </Space>
          ),
          value: '',
          title: 'ทั้งหมด',
        },
        ...OCC_OPTIONS,
      ]
    : OCC_OPTIONS;

  return (
    <Select
      {...props}
      options={options}
      // Show the label (with avatar) also when value is selected
      labelRender={(item) => {
        const occ = item.value as string;
        if (!occ) return <span style={{ color: '#94a3b8' }}>ทุกอาชีพ</span>;
        const validOcc = OCCUPATIONS.find((o) => o === occ);
        if (!validOcc) return <span>{occ}</span>;
        return <OccupationLabel occ={validOcc} />;
      }}
      filterOption={(input, opt) =>
        (opt?.title as string ?? '').toLowerCase().includes(input.toLowerCase())
      }
    />
  );
}
