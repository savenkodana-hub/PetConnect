import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { max } from 'd3-array';
import { scaleBand, scaleLinear } from 'd3-scale';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

const HEIGHT = 240;
const MARGIN = { top: 18, right: 18, bottom: 42, left: 44 };

const normalizeData = (data) =>
  (Array.isArray(data) ? data : []).map((item, index) => {
    const value = Number(item?.value);

    return {
      label: String(item?.label || `Item ${index + 1}`),
      value: Number.isFinite(value) ? Math.max(0, value) : 0
    };
  });

export default function ActivityMixChart({ data }) {
  const [width, setWidth] = useState(0);
  const items = useMemo(() => normalizeData(data), [data]);

  const chart = useMemo(() => {
    if (!width || !items.length) {
      return null;
    }

    const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const maximum = max(items, (item) => item.value) || 0;
    const xScale = scaleBand()
      .domain(items.map((item) => item.label))
      .range([MARGIN.left, MARGIN.left + plotWidth])
      .padding(0.28);
    const yScale = scaleLinear()
      .domain([0, Math.max(1, maximum)])
      .nice()
      .range([MARGIN.top + plotHeight, MARGIN.top]);

    return {
      items,
      xScale,
      yScale,
      yTicks: yScale.ticks(4).filter(Number.isInteger)
    };
  }, [items, width]);

  return (
    <View
      style={styles.container}
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
    >
      {chart ? (
        <Svg width={width} height={HEIGHT} accessibilityLabel="Pets, posts, groups, and likes bar chart">
          <G>
            {chart.yTicks.map((tick) => {
              const y = chart.yScale(tick);

              return (
                <G key={`y-${tick}`}>
                  <Line
                    x1={MARGIN.left}
                    x2={width - MARGIN.right}
                    y1={y}
                    y2={y}
                    stroke="#e6f2ea"
                  />
                  <SvgText
                    x={MARGIN.left - 8}
                    y={y + 4}
                    fill="#5f7569"
                    fontSize="11"
                    textAnchor="end"
                  >
                    {tick}
                  </SvgText>
                </G>
              );
            })}

            <Line
              x1={MARGIN.left}
              x2={MARGIN.left}
              y1={MARGIN.top}
              y2={HEIGHT - MARGIN.bottom}
              stroke="#9bb5a6"
            />
            <Line
              x1={MARGIN.left}
              x2={width - MARGIN.right}
              y1={HEIGHT - MARGIN.bottom}
              y2={HEIGHT - MARGIN.bottom}
              stroke="#9bb5a6"
            />

            {chart.items.map((item) => {
              const x = chart.xScale(item.label);
              const y = chart.yScale(item.value);
              const barHeight = HEIGHT - MARGIN.bottom - y;
              const barWidth = chart.xScale.bandwidth();

              return (
                <G key={item.label}>
                  <Rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={4}
                    fill="#2f8f68"
                  />
                  <SvgText
                    x={x + barWidth / 2}
                    y={Math.max(MARGIN.top + 11, y - 6)}
                    fill="#173b2c"
                    fontSize="11"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {item.value}
                  </SvgText>
                  <Line
                    x1={x + barWidth / 2}
                    x2={x + barWidth / 2}
                    y1={HEIGHT - MARGIN.bottom}
                    y2={HEIGHT - MARGIN.bottom + 5}
                    stroke="#9bb5a6"
                  />
                  <SvgText
                    x={x + barWidth / 2}
                    y={HEIGHT - 16}
                    fill="#5f7569"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {item.label}
                  </SvgText>
                </G>
              );
            })}
          </G>
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: HEIGHT
  }
});
