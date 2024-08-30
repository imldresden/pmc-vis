package prism.core.View;

/**
 * Enum used to regulate the types of Abstractions that can be used.
 *
 * Essentially just a way to translate between Jersey API Input and View class types
 */
public enum ViewType {
    IdentityView,

    APView,

    ReachabilityView,

    PropertyView,

    DistanceView,

    InitView,

    OutActSetSizeView,

    OutActView,

    InActView,

    InActIdentView,

    OutActIdentView,

    VariablesView,

    VariablesViewCnf,

    VariablesViewDnf,

    CycleView,

    CycleHasView,

    SccView,

    SccbView,

    CollapseDualDirTransView,

    Clear,

    Remove
}
