
'use client';

import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { convertGradeToDisplay } from '@/lib/attendance-utils';
import type { DayStats } from '@/hooks/use-attendance-data';

interface DayDetailProps {
  selectedDate: Date;
  dayStats: DayStats[];
  loading: boolean;
}

export const DayDetail: React.FC<DayDetailProps> = ({
  selectedDate,
  dayStats,
  loading
}) => {
  const totalAttendees = dayStats.reduce((total, team) => 
    total + team.gradeStats.reduce((teamTotal, grade) => teamTotal + grade.count, 0), 
  0);

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {format(selectedDate, 'yyyy年MM月dd日', { locale: ja })} の出席状況
        </h3>
        {totalAttendees > 0 && (
          <span className="font-bold text-gray-800">
            合計: {totalAttendees}人
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : totalAttendees > 0 ? (
        <div className="space-y-6">
          {dayStats.map(teamStat => (
            teamStat.gradeStats.some(gs => gs.count > 0) && (
              <div key={teamStat.teamId} className="border rounded-lg p-4">
                <h4 className="font-semibold text-md mb-3">
                  {teamStat.teamName || `班: ${teamStat.teamId}`}
                </h4>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {teamStat.gradeStats
                    .filter(gradeStat => gradeStat.count > 0)
                    .map(gradeStat => (
                    <div key={gradeStat.grade} className="bg-gray-50 rounded p-3 text-center">
                        <div className="font-medium">{convertGradeToDisplay(gradeStat.grade)}</div>
                        <div className="text-2xl font-bold text-blue-600 mt-1">
                            {gradeStat.count}人
                        </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          この日の出席記録はありません
        </div>
      )}
    </div>
  );
};
