package prism.db.mappers;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import prism.core.Namespace;
import prism.core.Project;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class RewardMapper implements RowMapper<Map<String, Double>> {

    private List<String> rewardNames;

    public RewardMapper(Project project){
        rewardNames = project.getModulesFile().getRewardStructNames();
    }

    @Override
    public Map<String, Double> map(ResultSet rs, StatementContext ctx) throws SQLException {
        Map<String, Double> out = new HashMap<>();
        ResultSetMetaData rsm = rs.getMetaData();
        for (int i = 1; i <= rsm.getColumnCount();i++){
            String collumn = rsm.getColumnName(i);
            if (collumn.startsWith(Namespace.ENTRY_REW)){
                int l = Integer.parseInt(collumn.replace(Namespace.ENTRY_REW, ""));
                out.put(rewardNames.get(l), rs.getDouble(collumn));
            }
        }
        return out;
    }
}
