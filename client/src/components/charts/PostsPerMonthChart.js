import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { max } from 'd3-array';
import { scaleLinear, scaleTime } from 'd3-scale';
import { curveMonotoneX, line } from 'd3-shape';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

const HEIGHT = 230;
const MARGIN = { top: 16, right: 18, bottom: 42, left: 44 };

const formatMonth = (date) =>
  date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

const normalizeData = (data) =>
  (Array.isArray(data) ? data : [])
    .map((item) => {
      const year = Number(item?.year);
      const month = Number(item?.month);
      const count = Number(item?.count);

      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return null;
      }

      return {
        date: new Date(year, month - 1, 1),
        count: Number.isFinite(count) ? Math.max(0, count) : 0
      };
    })
    .filter(Boolean)
    .sort((first, second) => first.date - second.date);

export default function PostsPerMonthChart({ data }) {
  const [width, setWidth] = useState(0);
  const points = useMemo(() => normalizeData(data), [data]);

  const chart = useMemo(() => {
    if (!width || !points.length) {
      return null;
    }

    const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const firstDate = points[0].date;
    const lastDate = points[points.length - 1].date;
    const singlePointPadding = 15 * 24 * 60 * 60 * 1000;
    const xDomain = points.length === 1
      ? [new Date(firstDate.getTime() - singlePointPadding), new Date(firstDate.getTime() + singlePointPadding)]
      : [firstDate, lastDate];
    const maximum = max(points, (item) => item.count) || 0;
    const xScale = scaleTime().domain(xDomain).range([MARGIN.left, MARGIN.left + plotWidth]);
    const yScale = scaleLinear()
      .domain([0, Math.max(1, maximum)])
      .nice()
      .range([MARGIN.top + plotHeight, MARGIN.top]);
    const yTicks = yScale.ticks(4).filter(Number.isInteger);
    const xTicks = xScale.ticks(Math.min(6, Math.max(1, points.length)));
    const path = line()
      .x((item) => xScale(item.date))
      .y((item) => yScale(item.count))
      .curve(curveMonotoneX)(points);

    return { path, points, xScale, xTicks, yScale, yTicks };
  }, [points, width]);

  return (
    <View
      style={styles.container}
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
    >
      {chart ? (
        <Svg width={width} height={HEIGHT} accessibilityLabel="Posts created per month line chart">
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

            {chart.xTicks.map((tick) => {
              const x = chart.xScale(tick);

              return (
                <G key={`x-${tick.getTime()}`}>
                  <Line
                    x1={x}
                    x2={x}
                    y1={HEIGHT - MARGIN.bottom}
                    y2={HEIGHT - MARGIN.bottom + 5}
                    stroke="#9bb5a6"
                  />
                  <SvgText
                    x={x}
                    y={HEIGHT - 16}
                    fill="#5f7569"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {formatMonth(tick)}
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
            {chart.path ? (
              <Path d={chart.path} fill="none" stroke="#2f8f68" strokeWidth={3} />
            ) : null}
            {chart.points.map((item) => (
              <Circle
                key={`${item.date.getTime()}-${item.count}`}
                cx={chart.xScale(item.date)}
                cy={chart.yScale(item.count)}
                r={4}
                fill="#ffffff"
                stroke="#2f8f68"
                strokeWidth={2}
              />
            ))}
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
