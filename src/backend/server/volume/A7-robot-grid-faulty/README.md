# Robot Grid
## Setting
This case study considers the interaction of two robots in a 2D grid, where one robot can be controlled and the other is assummed to be controlled by the environment. Both robots can move north, south, west, and east or remain at the same location. For each move there is non-zero probability that the robot moves in another direction, although not in the opposite direction (i.e., when choosing north, the probability of going south is zero).
The task of the controllable robot is to maintain a machine whenever the environment robot visits it with probability at least 0.75.

## PRISM Program
The PRISM program contains one module for each robot and a scheduler module that determines which robot can make a move. Additionally, the program contains a policy (and faulty policy) module that prescribes how the controllable robot behaves. The task of the robot is formalized as a Büchi condition, that is, it has to be infinitely often the case that if the environment robot visits the machine, the controllable robot is also at the machine.

There are two variations of the program. In the first version, the policy is faulty and does not ensure that the controllable robot accomplishes its task. The second version contains a policy module that ensure the task is satisfied.