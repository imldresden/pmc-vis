package prism.core.Utility.Prism;

import parser.State;
import parser.ast.Module;
import parser.ast.*;
import prism.Evaluator;
import prism.PrismComponent;
import prism.PrismException;
import prism.PrismLangException;

/**
 * Extension for a prism class needed for project functionality
 */
public class Updater extends simulator.Updater<Double>{
    public Updater(ModulesFile modulesFile, PrismComponent parent) throws PrismException {
        super((ModulesFile) modulesFile.deepCopy().replaceConstants(modulesFile.getConstantValues()).simplify(), modulesFile.createVarList(), Evaluator.forDouble(), parent);
    }

    /**
     * Calculate the state rewards for a given state.
     * @param state The state to compute rewards for
     * @param store An array in which to store the rewards
     */
    public void calculateStateRewards(State state, double[] store) throws PrismLangException
    {
        int i, j, n;
        double d;
        RewardStruct rw;
        for (i = 0; i < numRewardStructs; i++) {
            rw = modulesFile.getRewardStruct(i);
            n = rw.getNumItems();
            d = 0.0;
            for (j = 0; j < n; j++) {
                if (!rw.getRewardStructItem(j).isTransitionReward())
                    if (rw.getStates(j).evaluateBoolean(state))
                        d += rw.getReward(j).evaluateDouble(state);
            }
            store[i] = d;
        }
    }

    /**
     * Calculate the transition rewards for a given state and outgoing choice.
     * @param state The state to compute rewards for
     * @param ch The integer choice from the state to compute rewards for
     * @param store An array in which to store the rewards
     */
    public void calculateTransitionRewards(State state, int ch, double[] store) throws PrismLangException
    {
        int i, j, n;
        double d;
        RewardStruct rw;
        for (i = 0; i < numRewardStructs; i++) {
            rw = modulesFile.getRewardStruct(i);
            n = rw.getNumItems();
            d = 0.0;
            for (j = 0; j < n; j++) {
                if (rw.getRewardStructItem(j).isTransitionReward())
                    if (rw.getRewardStructItem(j).getSynchIndex() == Math.max(0, ch))
                        if (rw.getStates(j).evaluateBoolean(state))
                            d += rw.getReward(j).evaluateDouble(state);
            }
            store[i] = d;
        }
    }

    // Private helpers

    /**
     * Determine the enabled updates for the 'm'th module from (global) state 'state'.
     * Update information in updateLists, enabledSynchs and enabledModules.
     * @param m The module index
     * @param state State from which to explore
     */
    protected void calculateUpdatesForModule(int m, State state) throws PrismLangException
    {
        Module module;
        Command command;
        int i, j, n;

        module = modulesFile.getModule(m);
        n = module.getNumCommands();
        for (i = 0; i < n; i++) {
            command = module.getCommand(i);
            if (command.getGuard().evaluateBoolean(state)) {
                j = command.getSynchIndex();
                Updates updates = command.getUpdates();

                updateLists.get(m).get(j).add(updates);
                enabledSynchs.set(j);
                enabledModules[j].set(m);
            }
        }
    }

//    public Map<Integer, Set<State>> inverseTransition(State state, TransitionList transitionList) throws PrismLangException {
//        List<ChoiceListFlexi> chs;
//        List<Set<State>> sts;
//        int i, j, k, l, n, count;
//        Map<Integer, Set<State>> reachableStates = new HashMap<>();
//
//        // Clear lists/bitsets
//        transitionList.clear();
//        for (i = 0; i < numModules; i++) {
//            for (j = 0; j < numSynchs + 1; j++) {
//                updateLists.get(i).get(j).clear();
//            }
//        }
//        enabledSynchs.clear();
//        for (i = 0; i < numSynchs + 1; i++) {
//            enabledModules[i].clear();
//        }
//
//        // Calculate the available updates for each module/action
//        // (update information in updateLists, enabledSynchs and enabledModules)
//        for (i = 0; i < numModules; i++) {
//            calculateUpdatesForModule(i, state);
//        }
//        //System.out.println("updateLists: " + updateLists);
//
//        // Add independent transitions for each (enabled) module to list
//        for (i = enabledModules[0].nextSetBit(0); i >= 0; i = enabledModules[0].nextSetBit(i + 1)) {
//            for (Updates ups : updateLists.get(i).get(0)) {
//                Set<State>reach = new HashSet<>();
//                ChoiceListFlexi ch = reverseUpdatesAndCreateNewChoice(-(i + 1), ups, state, reach);
//                if (ch.size() > 0){
//                    transitionList.add(ch);
//                    reachableStates.put(transitionList.getNumTransitions()-1, reach);
//                }
//
//            }
//        }
//        // Add synchronous transitions to list
//        chs = new ArrayList<>();
//        sts = new ArrayList<>();
//        for (i = enabledSynchs.nextSetBit(1); i >= 0; i = enabledSynchs.nextSetBit(i + 1)) {
//            chs.clear();
//            // Check counts to see if this action is blocked by some module
//            if (enabledModules[i].cardinality() < synchModuleCounts[i - 1])
//                continue;
//            // If not, proceed...
//            for (j = enabledModules[i].nextSetBit(0); j >= 0; j = enabledModules[i].nextSetBit(j + 1)) {
//                count = updateLists.get(j).get(i).size();
//                // Case where there is only 1 Updates for this module
//                if (count == 1) {
//                    Updates ups = updateLists.get(j).get(i).get(0);
//                    // Case where this is the first Choice created
//                    if (chs.size() == 0) {
//                        Set<State> reach = new HashSet<>();
//                        ChoiceListFlexi ch = reverseUpdatesAndCreateNewChoice(i, ups, state, reach);
//                        if (ch.size() > 0){
//                            chs.add(ch);
//                            sts.add(reach);
//                        }
//                    }
//                    // Case where there are existing Choices
//                    else {
//                        // Product with all existing choices
//                        for (k = 0; k < chs.size(); k++) {
//                            reverseUpdatesAndAddToProduct(ups, state, chs.get(k), sts.get(k));
//                        }
//                    }
//                }
//                // Case where there are multiple Updates (i.e. local nondeterminism)
//                else {
//                    // Case where there are no existing choices
//                    if (chs.size() == 0) {
//                        for (Updates ups : updateLists.get(j).get(i)) {
//                            Set<State> reach = new HashSet<>();
//                            ChoiceListFlexi ch = reverseUpdatesAndCreateNewChoice(i, ups, state, reach);
//                            if (ch.size() > 0){
//                                chs.add(ch);
//                                sts.add(reach);
//                            }
//                        }
//                    }
//                    // Case where there are existing Choices
//                    else {
//                        // Duplicate (count-1 copies of) current Choice list
//                        n = chs.size();
//                        for (k = 0; k < count - 1; k++)
//                            for (l = 0; l < n; l++){
//                                chs.add(new ChoiceListFlexi(chs.get(l)));
//                                sts.add(new HashSet<>(sts.get(l)));
//                            }
//                        // Products with existing choices
//                        for (k = 0; k < count; k++) {
//                            Updates ups = updateLists.get(j).get(i).get(k);
//                            for (l = 0; l < n; l++) {
//                                reverseUpdatesAndAddToProduct(ups, state, chs.get(k * n + l), sts.get(k * n + l));
//                            }
//                        }
//                    }
//                }
//            }
//            // Add all new choices to transition list
//            for (k = 0; k < chs.size(); k++) {
//                transitionList.add(chs.get(k));
//                reachableStates.put(k, sts.get(k));
//            }
//        }
//
//        // For a DTMC, we need to normalise across all transitions
//        // This is partly to handle "local nondeterminism"
//        // and also to handle any dubious trickery done by disabling probability checks
//        if (modelType == ModelType.DTMC) {
//            double probSum = transitionList.getProbabilitySum();
//            transitionList.scaleProbabilitiesBy(1.0 / probSum);
//        }
//
//        // Check validity of the computed transitions
//        // (not needed currently)
//        //transitionList.checkValid(modelType);
//
//        // Check for errors (e.g. overflows) in the computed transitions
//        //transitionList.checkForErrors(state, varList);
//
//        //System.out.println(transitionList);
//
//        return reachableStates;
//
//
//        /*transitionList.clear();
//
//        for (Update update : transitionDefinition.getUpdates().getUpdates()){
//            List<String> updatedVars = update.getAllVars();
//            for (int i = 0; i < update.getNumElements(); i++) {
//                updatedVars.add(update.getVar(i));
//            }
//
//            List<Values> possibleValues = this.varList.getAllValues(updatedVars);
//            for (Values varCombination : possibleValues){
//                if (transitionDefinition.getGuard().evaluateBoolean(varCombination)){
//                    State cur = new State(varCombination, this.modulesFile);
//                    State res = update.checkUpdate(cur, this.varList);
//                    if (res.equals(state)){
//                        canReach.add(cur);
//                    }
//                }
//
//            }
//        }
//
//        return canReach;*/
//    }

/*    private ChoiceListFlexi reverseUpdatesAndCreateNewChoice(int moduleOrActionIndex, Updates ups, State state, Set<State> reach) throws PrismLangException
    {
        ChoiceListFlexi ch;
        List<Update> list;
        int i, n;
        double p, sum;

        // Create choice and add all info
        ch = new ChoiceListFlexi<Double>(Evaluator.forDouble());
        ch.setModuleOrActionIndex(moduleOrActionIndex);
        n = ups.getNumUpdates();
        sum = 0;
        for (i = 0; i < n; i++) {
            // Compute probability/rate
            p = ups.getProbabilityInState(i, state);
            // Check for non-finite/NaN probabilities/rates
            if (!Double.isFinite(p) || p < 0) {
                String s = modelType.choicesSumToOne() ? "Probability" : "Rate";
                s += " is invalid (" + p + ") in state " + state.toString(modulesFile);
                // Note: we indicate error in whole Updates object because the offending
                // probability expression has probably been simplified from original form.
                throw new PrismLangException(s, ups);
            }
            // Skip transitions with zero probability/rate
            if (p == 0)
                continue;
            sum += p;
            list = new ArrayList<>();
            list.add(ups.getUpdate(i));
            ch.add(p, list);
        }
        // For now, PRISM treats empty (all zero probs/rates) distributions as an error.
        // Later, when errors in symbolic project construction are improved, this might be relaxed.
        if (ch.size() == 0) {
            String msg = modelType.probabilityOrRate();
            msg += (ups.getNumUpdates() > 1) ? " values sum to " : " is ";
            msg += "zero for updates in state " + state.toString(modulesFile);
            throw new PrismLangException(msg, ups);
        }
        // Check distribution sums to 1 (if required, and if is non-empty)
        if (doProbChecks && ch.size() > 0 && modelType.choicesSumToOne() && Math.abs(sum - 1) > sumRoundOff) {
            throw new PrismLangException("Probabilities sum to " + sum + " in state " + state.toString(modulesFile), ups);
        }
        return ch;
    }

    private void reverseUpdatesAndAddToProduct(Updates ups, State state, ChoiceListFlexi ch, Set<State> reach) throws PrismLangException
    {
        // Create new choice (action index is 0 - not needed)
        ChoiceListFlexi chNew = reverseUpdatesAndCreateNewChoice(0, ups, state, reach);
        // Build product with existing
        ch.productWith(chNew);
    }*/
}
