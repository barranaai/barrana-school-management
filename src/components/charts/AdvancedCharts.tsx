import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ComposedChart,
  Scatter,
  ScatterChart,
  ZAxis,
} from 'recharts';

interface ChartData {
  name: string;
  value: number;
  [key: string]: any;
}

interface AdvancedChartsProps {
  data: ChartData[];
  type: 'line' | 'area' | 'bar' | 'pie' | 'radar' | 'scatter' | 'composed';
  title?: string;
  height?: number;
  colors?: string[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export const AdvancedCharts: React.FC<AdvancedChartsProps> = ({
  data,
  type,
  title,
  height = 300,
  colors = COLORS,
}) => {
  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart data={data} height={height}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke={colors[0]}
              strokeWidth={2}
              dot={{ fill: colors[0], strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        );

      case 'area':
        return (
          <AreaChart data={data} height={height}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="value"
              stroke={colors[0]}
              fill={colors[0]}
              fillOpacity={0.3}
            />
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart data={data} height={height}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill={colors[0]} />
          </BarChart>
        );

      case 'pie':
        return (
          <PieChart height={height}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        );

      case 'radar':
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data} height={height}>
            <PolarGrid />
            <PolarAngleAxis dataKey="name" />
            <PolarRadiusAxis angle={30} domain={[0, 100]} />
            <Radar
              name="Performance"
              dataKey="value"
              stroke={colors[0]}
              fill={colors[0]}
              fillOpacity={0.3}
            />
            <Tooltip />
            <Legend />
          </RadarChart>
        );

      case 'scatter':
        return (
          <ScatterChart height={height}>
            <CartesianGrid />
            <XAxis type="number" dataKey="x" name="x" />
            <YAxis type="number" dataKey="y" name="y" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Data Points" data={data} fill={colors[0]} />
          </ScatterChart>
        );

      case 'composed':
        return (
          <ComposedChart data={data} height={height}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="area"
              fill={colors[0]}
              fillOpacity={0.3}
              stroke={colors[0]}
            />
            <Bar dataKey="bar" fill={colors[1]} />
            <Line type="monotone" dataKey="line" stroke={colors[2]} />
          </ComposedChart>
        );

      default:
        return <div>Unsupported chart type</div>;
    }
  };

  return (
    <div style={{ width: '100%', height }}>
      {title && (
        <h3 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
};

// Specialized chart components
export const StudentProgressChart: React.FC<{ data: any[] }> = ({ data }) => (
  <AdvancedCharts
    data={data}
    type="line"
    title="Student Progress Over Time"
    height={400}
    colors={['#1976d2', '#2e7d32', '#ed6c02']}
  />
);

export const AcademicPerformanceChart: React.FC<{ data: any[] }> = ({ data }) => (
  <AdvancedCharts
    data={data}
    type="radar"
    title="Academic Performance by Subject"
    height={400}
    colors={['#1976d2']}
  />
);

export const TeacherActivityChart: React.FC<{ data: any[] }> = ({ data }) => (
  <AdvancedCharts
    data={data}
    type="bar"
    title="Teacher Activity Overview"
    height={300}
    colors={['#2e7d32']}
  />
);

export const ReportDistributionChart: React.FC<{ data: any[] }> = ({ data }) => (
  <AdvancedCharts
    data={data}
    type="pie"
    title="Report Distribution by Type"
    height={300}
    colors={['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#f44336']}
  />
);

export const EngagementTrendChart: React.FC<{ data: any[] }> = ({ data }) => (
  <AdvancedCharts
    data={data}
    type="area"
    title="Parent Engagement Trends"
    height={350}
    colors={['#9c27b0']}
  />
);

export default AdvancedCharts; 