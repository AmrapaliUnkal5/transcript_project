import React, { useState, useEffect } from "react";
import { authApi } from "../services/api";
import { TeamMember, TeamInvitation, TeamMemberRole } from "../types";
import {
  Users,
  UserPlus,
  Mail,
  CheckCircle,
  XCircle,
  Shield,
  Edit2,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import { useSubscriptionPlans } from "../context/SubscriptionPlanContext";
import { useAuth } from "../context/AuthContext";

// Role display configuration
const roleConfig = {
  [TeamMemberRole.ADMIN]: {
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    label: "Admin",
    description: "Can manage team members and all bots",
  },
  [TeamMemberRole.EDITOR]: {
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    label: "Editor",
    description: "Can edit bot settings and data",
  },
  [TeamMemberRole.VIEWER]: {
    color: "text-green-600",
    bgColor: "bg-green-100",
    label: "Viewer",
    description: "Can only view bots and analytics",
  },
};

const TeamManagement: React.FC = () => {
  // State
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamMemberRole>(TeamMemberRole.EDITOR);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [editMemberId, setEditMemberId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState<TeamMemberRole>(
    TeamMemberRole.EDITOR
  );
  const { user } = useAuth();
  const { getPlanById } = useSubscriptionPlans();
  const userPlanId = user?.subscription_plan_id || 1;
  const userPlan = getPlanById(userPlanId);
  const adminUserLimit = userPlan?.admin_user_limit ?? 0; // checking the Admin limit
  const [isLimitReachedModalOpen, setIsLimitReachedModalOpen] = useState(false);
  const [isAdminLimitReached, setIsAdminLimitReached] = useState(false);

  const [error, setError] = useState("");

  // Fetch team members and invitations
  const fetchTeamData = async () => {
    setIsLoading(true);
    try {
      const [membersData, invitationsData] = await Promise.all([
        authApi.getTeamMembers(),
        authApi.getPendingInvitations(),
      ]);
      const totalAdminsUsed =
        (membersData?.length || 0) + (invitationsData?.length || 0);

      setTeamMembers(membersData || []);
      setInvitations(invitationsData || []);
      setIsAdminLimitReached(totalAdminsUsed >= adminUserLimit); // check limit here
    } catch (error) {
      console.error("Failed to fetch team data:", error);
      toast.error("Failed to load team data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  // Handle invite form submission
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!email.trim()) {
      toast.error("Please enter a valid email");
      return;
    }
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    // Continue with form submission if email is valid
    setError(""); // Clear error if valid
    console.log("Email is valid: ", email);
    // Call your submit function or logic here

    setIsLoading(true);
    try {
      await authApi.inviteTeamMember({ email, role });
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      setRole(TeamMemberRole.EDITOR);
      setIsInviteModalOpen(false);
      fetchTeamData();
    } catch (error: any) {
      console.error("Failed to send invitation:", error);
      toast.error(error.response?.data?.detail || "Failed to send invitation");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle invitation response
  const handleInvitationResponse = async (
    token: string,
    response: "accepted" | "declined"
  ) => {
    setIsLoading(true);
    try {
      await authApi.respondToInvitation(token, response);
      toast.success(`Invitation ${response} successfully`);
      fetchTeamData();
    } catch (error) {
      console.error(`Failed to ${response} invitation:`, error);
      toast.error(`Failed to ${response} invitation`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle updating team member role
  const handleUpdateMember = async () => {
    if (!editMemberId) return;

    setIsLoading(true);
    try {
      await authApi.updateTeamMember(editMemberId, { role: editRole });
      toast.success("Team member role updated");
      setEditMemberId(null);
      fetchTeamData();
    } catch (error) {
      console.error("Failed to update team member:", error);
      toast.error("Failed to update team member");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle removing team member
  const handleRemoveMember = async (memberId: number) => {
    if (!window.confirm("Are you sure you want to remove this team member?")) {
      return;
    }

    setIsLoading(true);
    try {
      await authApi.removeTeamMember(memberId);
      toast.success("Team member removed");
      fetchTeamData();
    } catch (error) {
      console.error("Failed to remove team member:", error);
      toast.error("Failed to remove team member");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {isLimitReachedModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h2 className="text-lg font-semibold mb-2 text-red-600">
              Admin Limit Reached
            </h2>
            <p className="text-sm text-gray-700 mb-4">
              You've reached your plan's admin user limit of {adminUserLimit}.
              Please remove a team member or cancel a pending invitation to
              invite someone new.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setIsLimitReachedModalOpen(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center">
          <Users className="mr-2 h-5 w-5" />
          Team Management
        </h2>
        <button
          onClick={() => {
            if (isAdminLimitReached) {
              setIsLimitReachedModalOpen(true);
            } else {
              setIsInviteModalOpen(true);
            }
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center"
          disabled={isLoading}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Team Member
        </button>
      </div>

      {/* Invitations Section */}
      {invitations.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-white flex items-center">
            <Mail className="mr-2 h-5 w-5" />
            Pending Invitations
          </h3>
          <div className="space-y-4">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="border rounded-lg p-4 flex justify-between items-center"
              >
                <div>
                  <p className="font-medium">{invitation.owner_name}</p>
                  <p className="text-sm text-gray-500">
                    {invitation.owner_email}
                  </p>
                  <div
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      roleConfig[invitation.role].bgColor
                    } ${roleConfig[invitation.role].color} mt-2`}
                  >
                    {roleConfig[invitation.role].label}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() =>
                      handleInvitationResponse(
                        invitation.invitation_token,
                        "accepted"
                      )
                    }
                    className="p-2 bg-green-100 text-green-600 rounded-md hover:bg-green-200"
                    disabled={isLoading}
                  >
                    <CheckCircle className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() =>
                      handleInvitationResponse(
                        invitation.invitation_token,
                        "declined"
                      )
                    }
                    className="p-2 bg-red-100 text-red-600 rounded-md hover:bg-red-200"
                    disabled={isLoading}
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team Members Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-white flex items-center">
          <Shield className="mr-2 h-5 w-5" />
          Team Members
        </h3>

        {teamMembers.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">
            No team members yet. Invite someone to your team!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                {teamMembers.map((member) => (
                  <tr key={member.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {member.member_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {member.member_email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editMemberId === member.member_id ? (
                        <select
                          value={editRole}
                          onChange={(e) =>
                            setEditRole(e.target.value as TeamMemberRole)
                          }
                          className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600"
                        >
                          {" "}
                          <option value={TeamMemberRole.EDITOR}>Editor</option>
                          {/* <option value={TeamMemberRole.ADMIN}>Admin</option>
                          <option value={TeamMemberRole.EDITOR}>Editor</option>
                          <option value={TeamMemberRole.VIEWER}>Viewer</option> */}
                        </select>
                      ) : (
                        <div
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            roleConfig[member.role as TeamMemberRole].bgColor
                          } ${roleConfig[member.role as TeamMemberRole].color}`}
                        >
                          {roleConfig[member.role as TeamMemberRole].label}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.invitation_status === "accepted"
                            ? "bg-green-100 text-green-800"
                            : member.invitation_status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {member.invitation_status.charAt(0).toUpperCase() +
                          member.invitation_status.slice(1)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {editMemberId === member.member_id ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={handleUpdateMember}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            disabled={isLoading}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditMemberId(null)}
                            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setEditMemberId(member.member_id);
                              setEditRole(member.role as TeamMemberRole);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            disabled={isLoading}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveMember(member.member_id)}
                            className="p-1 text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            disabled={isLoading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-30"
              onClick={() => setIsInviteModalOpen(false)}
            ></div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl z-10 p-6 w-full max-w-md">
              <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-white">
                Invite Team Member
              </h3>

              <form onSubmit={handleInvite}>
                <div className="mb-4">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="colleague@company.com"
                    required
                  />
                  {error && (
                    <div className="text-red-500 text-sm mt-1">{error}</div>
                  )}
                </div>

                <div className="mb-6">
                  <label
                    htmlFor="role"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Role
                  </label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as TeamMemberRole)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    {/* <option value={TeamMemberRole.ADMIN}>Admin - {roleConfig[TeamMemberRole.ADMIN].description}</option>
                    <option value={TeamMemberRole.EDITOR}>Editor - {roleConfig[TeamMemberRole.EDITOR].description}</option>
                    <option value={TeamMemberRole.VIEWER}>Viewer - {roleConfig[TeamMemberRole.VIEWER].description}</option> */}
                    <option value={TeamMemberRole.EDITOR}>
                      Editor - {roleConfig[TeamMemberRole.EDITOR].description}
                    </option>
                  </select>
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    disabled={isLoading}
                  >
                    {isLoading ? "Sending..." : "Send Invitation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
