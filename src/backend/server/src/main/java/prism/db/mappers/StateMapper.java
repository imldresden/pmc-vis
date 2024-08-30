package prism.db.mappers;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import prism.PrismLangException;
import prism.api.State;
import prism.core.Model;
import prism.core.Namespace;
import prism.core.cluster.Cluster;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Maps database output to Node Objects
 */
public class StateMapper implements RowMapper<State> {

    private final List<Cluster> clusters;
    private final Model model;

    private final ClusterMapper clusterMapper;

    private final PropertyMapper propertyMapper;

    private final RewardMapper rewardMapper;

    public StateMapper(Model model, List<Cluster> clusters) {
        this.model = model;
        this.clusters = clusters;
        this.clusterMapper = new ClusterMapper();
        this.propertyMapper = new PropertyMapper(model.getProperties());
        this.rewardMapper = new RewardMapper(model);
    }

    @Override
    public State map(final ResultSet rs, final StatementContext ctx) throws SQLException {
        if (clusters == null) {
            try {
                return new State(rs.getLong(Namespace.ENTRY_S_ID), rs.getString(Namespace.ENTRY_S_NAME), model.parseParameters(rs.getString(Namespace.ENTRY_S_NAME)), model.getLabelMap(model.parseState(rs.getString(Namespace.ENTRY_S_NAME))), rewardMapper.map(rs, ctx), propertyMapper.map(rs, ctx));
            }catch (PrismLangException e) {
                return new State(rs.getLong(Namespace.ENTRY_S_ID), rs.getString(Namespace.ENTRY_S_NAME), new TreeMap<>(), new TreeMap<>(), rewardMapper.map(rs, ctx), propertyMapper.map(rs, ctx));
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }
        return new State(rs.getString(Namespace.ENTRY_C_NAME), clusters.stream().map(c -> Long.toString(c.getId())).collect(Collectors.toList()), clusterMapper.map(rs, ctx));
    }
}
