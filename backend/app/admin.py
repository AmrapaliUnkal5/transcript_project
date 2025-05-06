from fastapi import Depends, Request, FastAPI
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.responses import RedirectResponse
from app.config import settings
from app.database import engine
from app.models import (
    User, Bot, File, Interaction, Language, UserAddon, 
    UserAuthProvider, ChatMessage, 
    DemoRequest, EmbeddingModel, LLMModel, SubscriptionPlan,
    Addon, UserSubscription, TeamMember, InteractionReaction, ScrapedNode, 
    WebsiteDB, YouTubeVideo, Notification, Cluster, ClusteredQuestion
)
from sqlalchemy.orm import Session
import jwt
from .database import get_db
from fastapi.security import OAuth2PasswordBearer
from .crud import get_user_by_email
from passlib.context import CryptContext
from app.utils.verify_password import verify_password
from app.utils.reembedding_utils import reembed_all_files, reembed_all_bot_data
import asyncio
from sqlalchemy.inspection import inspect

# Admin Authentication Backend
class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        email = form.get("username")
        password = form.get("password")

        # Verify user credentials using the existing login logic
        db_user = get_user_by_email(request.state.db, email=email)
        if not db_user or not verify_password(password, db_user.password):
            return False

        # Check if user has admin role
        if db_user.role != "admin":
            return False

        request.session.update({"authenticated": True, "user_email": email})
        return True

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return request.session.get("authenticated", False)

# Initialize Admin Panel
authentication_backend = AdminAuth(secret_key="SECRET_KEY")

# Model Views
class UserAdmin(ModelView, model=User):
    column_list = [
        User.user_id,
        User.email,
        User.name,
        User.role,
        User.avatar_url,
        User.is_verified,
        User.created_at
    ]
    column_searchable_list = [User.name, User.email,User.role]

class BotAdmin(ModelView, model=Bot):
    column_list = [
        Bot.bot_id,
        Bot.bot_name,
        Bot.user_id,
        Bot.is_active,
        Bot.created_at,
        "embedding_model",
        "llm_model"
    ]
    column_searchable_list = [Bot.bot_id]
    
    async def on_model_change(self, data, model, is_created, request):
        """
        When the embedding_model_id changes, automatically trigger re-embedding
        of all documents associated with the bot.
        """
        try:
            print(f"🔍 BotAdmin.on_model_change called - is_created: {is_created}")
            print(f"🔍 Model data: {model.__dict__}")
            print(f"🔍 Form data: {data}")
            
            # Only trigger re-embedding if this is an update (not a new creation)
            if not is_created:
                # Get the session from the request
                session = request.state.db
                
                # Check if embedding_model has changed by comparing form data with model data
                new_embedding_model_id = data.get('embedding_model')
                old_embedding_model_id = str(model.embedding_model_id) if model.embedding_model_id else None
                
                print(f"🔄 Embedding model comparison:")
                print(f"   - Old value (from model): {old_embedding_model_id}")
                print(f"   - New value (from form): {new_embedding_model_id}")
                
                if new_embedding_model_id and old_embedding_model_id != new_embedding_model_id:
                    print(f"🔄 Embedding model changed for bot {model.bot_id}.")
                    print(f"   - From: {old_embedding_model_id}")
                    print(f"   - To: {new_embedding_model_id}")
                    
                    # First, complete the parent method to save the model change
                    await super().on_model_change(data, model, is_created, request)
                    
                    # Explicitly update the model in the database
                    bot = session.query(Bot).filter(Bot.bot_id == model.bot_id).first()
                    if bot:
                        bot.embedding_model_id = int(new_embedding_model_id)
                        session.commit()
                        print(f"✅ Updated bot {model.bot_id} with new embedding model ID: {new_embedding_model_id}")
                    else:
                        print(f"❌ Could not find bot with ID {model.bot_id} in database")
                    
                    # Run the comprehensive re-embedding in the background to avoid blocking the admin UI
                    # This will now re-embed files, web scraping data, and YouTube data
                    task = asyncio.create_task(reembed_all_bot_data(model.bot_id, session))
                    
                    def callback(future):
                        try:
                            result = future.result()
                            print(f"✅ Re-embedding task completed for bot {model.bot_id}: {result}")
                        except Exception as e:
                            print(f"❌ Re-embedding task failed for bot {model.bot_id}: {str(e)}")
                    
                    task.add_done_callback(callback)
                    print(f"✅ Comprehensive re-embedding task started for bot {model.bot_id}")
                    
                    # Return None since we've already called the parent method
                    return None
                else:
                    print(f"ℹ️ No change detected in embedding model for bot {model.bot_id}")
            
            return await super().on_model_change(data, model, is_created, request)
            
        except Exception as e:
            import traceback
            print(f"❌ Error in on_model_change hook for bot {getattr(model, 'bot_id', 'unknown')}: {str(e)}")
            print(f"❌ Traceback: {traceback.format_exc()}")
            # Still allow the save to proceed by calling the parent method
            return await super().on_model_change(data, model, is_created, request)

class FileAdmin(ModelView, model=File):
    column_list = [
        File.file_id,
        File.file_name,
        File.file_type,
        File.bot_id,
        File.upload_date
    ]
    column_searchable_list = [File.file_name, File.file_type]
    column_filters = [File.bot_id]

class LanguageAdmin(ModelView, model=Language):
    column_list = [
        Language.language_id,
        Language.language_code,
        Language.language_name
    ]
    
    column_searchable_list = [Language.language_code, Language.language_name]
    column_filters = ["language_code", "language_name"]
   
# class PerformanceLogAdmin(ModelView, model=PerformanceLog):
#     column_list = [
#         PerformanceLog.log_id,
#         PerformanceLog.bot_id,
#         PerformanceLog.user_id,
#         PerformanceLog.interaction_count,
#         PerformanceLog.last_interaction,
#         PerformanceLog.created_at,
#         PerformanceLog.updated_at,
#     ]
#     column_searchable_list = [PerformanceLog.bot_id, PerformanceLog.user_id]
#     column_filters = ["bot_id", "user_id", "created_at"]

# class RatingAdmin(ModelView, model=Rating):
#     column_list = [
#         Rating.rating_id,
#         Rating.interaction_id,
#         Rating.user_id,
#         Rating.rating,
#         Rating.feedback,
#         Rating.created_at,
#     ]
#     column_searchable_list = [Rating.rating, Rating.feedback]
#     column_filters = ["interaction_id", "user_id", "rating"]

# class SubscriptionAdmin(ModelView, model=Subscription):
#     column_list = [
#         Subscription.subscription_id,
#         Subscription.user_id,
#         Subscription.bot_id,
#         Subscription.amount,
#         Subscription.currency,
#         Subscription.payment_date,
#         Subscription.expiry_date,
#         Subscription.status,
#     ]
#     column_searchable_list = [Subscription.currency, Subscription.status]
#     column_filters = ["user_id", "bot_id", "status"]

class UserAuthProviderAdmin(ModelView, model=UserAuthProvider):
    column_list = [
        UserAuthProvider.auth_id,
        UserAuthProvider.user_id,
        UserAuthProvider.provider_name,
        UserAuthProvider.provider_user_id,
        UserAuthProvider.access_token,
        UserAuthProvider.refresh_token,
        UserAuthProvider.token_expiry,
        UserAuthProvider.created_at,
    ]
    column_searchable_list = [UserAuthProvider.provider_name, UserAuthProvider.provider_user_id]
    column_filters = ["provider_name", "created_at"]

class InteractionAdmin(ModelView, model=Interaction):
    column_list = [
        Interaction.interaction_id,
        Interaction.bot_id,
        Interaction.user_id,
        Interaction.start_time,
        Interaction.archived
        ]
    column_searchable_list = [Interaction.bot_id]
    column_filters = ["timestamp"]

class ChatMessageAdmin(ModelView, model=ChatMessage):
    column_list = [
        ChatMessage.message_id,
        ChatMessage.interaction_id,
        ChatMessage.sender,
        ChatMessage.message_text,
        ChatMessage.timestamp
    ]
    column_searchable_list = [ChatMessage.interaction_id]
    column_filters = ["user_id", "bot_id", "timestamp"]

class DemoRequestAdmin(ModelView, model=DemoRequest):
    column_list = [
        DemoRequest.id,
        DemoRequest.name,
        DemoRequest.email,
        DemoRequest.country,
        DemoRequest.phone,
        DemoRequest.created_at,

    ]
    column_searchable_list = ["id"]
    column_filters = ["id"]

class EmbeddingModelAdmin(ModelView, model=EmbeddingModel):
    column_list = [
        EmbeddingModel.id,
        EmbeddingModel.name,
        EmbeddingModel.provider,
        EmbeddingModel.dimension,
        EmbeddingModel.is_active,
        EmbeddingModel.description
    ]
    column_searchable_list = [EmbeddingModel.name, EmbeddingModel.provider]

class LLMModelAdmin(ModelView, model=LLMModel):
    column_list = [
        LLMModel.id,
        LLMModel.name,
        LLMModel.provider,
        LLMModel.model_type,
        LLMModel.max_input_tokens,
        LLMModel.max_output_tokens,
        LLMModel.is_active,
        LLMModel.description
    ]
    column_searchable_list = [LLMModel.name, LLMModel.provider]

class SubscriptionPlanAdmin(ModelView, model=SubscriptionPlan):
    column_list = [
        SubscriptionPlan.id,
        SubscriptionPlan.name,
        SubscriptionPlan.price,
        SubscriptionPlan.word_count_limit,
        SubscriptionPlan.storage_limit,
        SubscriptionPlan.chatbot_limit,
        SubscriptionPlan.website_crawl_limit,
        SubscriptionPlan.youtube_grounding,
        SubscriptionPlan.message_limit,
        "default_embedding_model",
        "default_llm_model",
        SubscriptionPlan.created_at,
        SubscriptionPlan.updated_at
    ]
    column_searchable_list = [SubscriptionPlan.name]
    column_filters = ["name", "price", "created_at"]
    
    # Form configuration for model relationships
    form_args = {
        "default_embedding_model": {
            "label": "Default Embedding Model"
        },
        "default_llm_model": {
            "label": "Default LLM Model"
        }
    }

class AddonAdmin(ModelView, model=Addon):
    column_list = [
        Addon.id,
        Addon.name,
        Addon.price,
        Addon.description,
        Addon.created_at,
        Addon.updated_at
    ]
    column_searchable_list = [Addon.name, Addon.description]
    column_filters = ["name", "price", "created_at"]

class UserSubscriptionAdmin(ModelView, model=UserSubscription):
    column_list = [
        UserSubscription.id,
        UserSubscription.user_id,
        UserSubscription.subscription_plan_id,
        UserSubscription.amount,
        UserSubscription.currency,
        UserSubscription.payment_date,
        UserSubscription.expiry_date,
        UserSubscription.status,
        UserSubscription.auto_renew,
        UserSubscription.created_at,
        UserSubscription.updated_at
    ]
    column_searchable_list = [UserSubscription.user_id, UserSubscription.status]
    column_filters = ["user_id", "subscription_plan_id", "status", "payment_date", "expiry_date"]
    
    # Add form columns to include all fields
    form_columns = [
        UserSubscription.id,
        UserSubscription.user_id,
        UserSubscription.subscription_plan_id,
        UserSubscription.amount,
        UserSubscription.currency,
        UserSubscription.payment_date,
        UserSubscription.expiry_date,
        UserSubscription.status,
        UserSubscription.auto_renew,
        UserSubscription.zoho_subscription_id,
        UserSubscription.zoho_customer_id,
        UserSubscription.zoho_invoice_id,
        UserSubscription.cancellation_reason,
        UserSubscription.payment_method,
        UserSubscription.notes,
        UserSubscription.created_at,
        UserSubscription.updated_at
    ]

class TeamMemberAdmin(ModelView, model=TeamMember):
    column_list = [
        TeamMember.id,
        TeamMember.owner_id,
        TeamMember.member_id,
        TeamMember.role,
        TeamMember.invitation_status,
        TeamMember.invitation_sent_at,
        TeamMember.updated_at
    ]
    column_searchable_list = [TeamMember.owner_id, TeamMember.member_id, TeamMember.invitation_status]
    column_filters = ["owner_id", "member_id", "role", "invitation_status"]
    
    # Add form columns to include all fields
    form_columns = [
        TeamMember.id,
        TeamMember.owner_id,
        TeamMember.member_id,
        TeamMember.role,
        TeamMember.invitation_status,
        TeamMember.invitation_token,
        TeamMember.invitation_sent_at,
        TeamMember.updated_at
    ]

class InteractionReactionAdmin(ModelView, model=InteractionReaction):
    column_list = [
        InteractionReaction.id,
        InteractionReaction.bot_id,
        InteractionReaction.interaction_id,
        InteractionReaction.session_id,
        InteractionReaction.reaction,
        InteractionReaction.reaction_time,
        InteractionReaction.message_id
    ]
    column_searchable_list = [InteractionReaction.bot_id, InteractionReaction.interaction_id]
    column_filters = ["bot_id", "reaction", "reaction_time"]
    
    # Add form columns to include all fields
    form_columns = [
        InteractionReaction.id,
        InteractionReaction.bot_id,
        InteractionReaction.interaction_id,
        InteractionReaction.session_id,
        InteractionReaction.reaction,
        InteractionReaction.reaction_time,
        InteractionReaction.message_id
    ]

class ScrapedNodeAdmin(ModelView, model=ScrapedNode):
    column_list = [
        ScrapedNode.id,
        ScrapedNode.url,
        ScrapedNode.bot_id,
        ScrapedNode.created_at,
        ScrapedNode.title,
        ScrapedNode.website_id,
        ScrapedNode.is_deleted,
        ScrapedNode.nodes_text_count,
        ScrapedNode.embedding_status,
        ScrapedNode.last_embedded
    ]
    column_searchable_list = [ScrapedNode.url, ScrapedNode.title]
    column_filters = ["bot_id", "website_id", "is_deleted", "created_at", "embedding_status"]
    
    # Add form columns to include all fields
    form_columns = [
        ScrapedNode.id,
        ScrapedNode.url,
        ScrapedNode.bot_id,
        ScrapedNode.created_at,
        ScrapedNode.title,
        ScrapedNode.is_deleted,
        ScrapedNode.website_id,
        ScrapedNode.nodes_text_count,
        ScrapedNode.embedding_status,
        ScrapedNode.last_embedded,
        ScrapedNode.nodes_text
    ]

class WebsiteDBAdmin(ModelView, model=WebsiteDB):
    column_list = [
        WebsiteDB.id,
        WebsiteDB.domain,
        WebsiteDB.bot_id,
        WebsiteDB.created_at,
        WebsiteDB.is_deleted
    ]
    column_searchable_list = [WebsiteDB.domain]
    column_filters = ["bot_id", "is_deleted", "created_at"]
    
    # Add form columns to include all fields
    form_columns = [
        WebsiteDB.id,
        WebsiteDB.domain,
        WebsiteDB.bot_id,
        WebsiteDB.created_at,
        WebsiteDB.is_deleted
    ]

class YouTubeVideoAdmin(ModelView, model=YouTubeVideo):
    column_list = [
        YouTubeVideo.id,
        YouTubeVideo.video_id,
        YouTubeVideo.video_title,
        YouTubeVideo.video_url,
        YouTubeVideo.channel_name,
        YouTubeVideo.bot_id,
        YouTubeVideo.is_deleted,
        YouTubeVideo.created_at,
        YouTubeVideo.embedding_status,
        YouTubeVideo.last_embedded
    ]
    column_searchable_list = [YouTubeVideo.video_title, YouTubeVideo.channel_name, YouTubeVideo.video_id]
    column_filters = ["bot_id", "is_deleted", "is_playlist", "created_at", "embedding_status"]
    
    # Add form columns to include all fields
    form_columns = [
        YouTubeVideo.id,
        YouTubeVideo.video_source,
        YouTubeVideo.video_id,
        YouTubeVideo.video_title,
        YouTubeVideo.video_url,
        YouTubeVideo.channel_id,
        YouTubeVideo.channel_name,
        YouTubeVideo.duration,
        YouTubeVideo.upload_date,
        YouTubeVideo.is_playlist,
        YouTubeVideo.playlist_id,
        YouTubeVideo.playlist_name,
        YouTubeVideo.view_count,
        YouTubeVideo.likes,
        YouTubeVideo.description,
        YouTubeVideo.thumbnail_url,
        YouTubeVideo.bot_id,
        YouTubeVideo.transcript_count,
        YouTubeVideo.created_at,
        YouTubeVideo.is_deleted,
        YouTubeVideo.embedding_status,
        YouTubeVideo.last_embedded,
        YouTubeVideo.transcript
    ]

class NotificationAdmin(ModelView, model=Notification):
    column_list = [
        Notification.id,
        Notification.user_id,
        Notification.bot_id,
        Notification.event_type,
        Notification.event_data,
        Notification.is_read,
        Notification.created_at
    ]
    column_searchable_list = [Notification.user_id, Notification.event_type]
    column_filters = ["user_id", "bot_id", "event_type", "is_read", "created_at"]
    
    # Add form columns to include all fields
    form_columns = [
        Notification.id,
        Notification.user_id,
        Notification.bot_id,
        Notification.event_type,
        Notification.event_data,
        Notification.is_read,
        Notification.created_at
    ]

class ClusterAdmin(ModelView, model=Cluster):
    column_list = [
        Cluster.cluster_id,
        Cluster.bot_id,
        Cluster.cluster_number,
        Cluster.count
    ]
    column_searchable_list = [Cluster.bot_id, Cluster.cluster_number]
    column_filters = ["bot_id", "cluster_number", "count"]
    
    # Add form columns to include all fields
    form_columns = [
        Cluster.cluster_id,
        Cluster.bot_id,
        Cluster.cluster_number,
        Cluster.centroid,
        Cluster.count
    ]

class ClusteredQuestionAdmin(ModelView, model=ClusteredQuestion):
    column_list = [
        ClusteredQuestion.id,
        ClusteredQuestion.cluster_id,
        ClusteredQuestion.question_text
    ]
    column_searchable_list = [ClusteredQuestion.cluster_id, ClusteredQuestion.question_text]
    column_filters = ["cluster_id"]
    
    # Add form columns to include all fields
    form_columns = [
        ClusteredQuestion.id,
        ClusteredQuestion.cluster_id,
        ClusteredQuestion.question_text,
        ClusteredQuestion.embedding
    ]

class UserAddonAdmin(ModelView, model=UserAddon):
    column_list = [
        UserAddon.id,
        UserAddon.user_id,
        UserAddon.addon_id,
        UserAddon.subscription_id,
        UserAddon.purchase_date,
        UserAddon.expiry_date,
        UserAddon.is_active,
        UserAddon.auto_renew,
        UserAddon.status,
        UserAddon.remaining_count,
        UserAddon.initial_count,
        UserAddon.created_at,
        UserAddon.updated_at
    ]
    column_searchable_list = [UserAddon.user_id, UserAddon.addon_id, UserAddon.status]
    column_filters = [
        "user_id", 
        "addon_id", 
        "subscription_id", 
        "is_active", 
        "status", 
        "purchase_date", 
        "expiry_date"
    ]
    
    # Add form columns to include all fields
    form_columns = [
        UserAddon.user_id,
        UserAddon.addon_id,
        UserAddon.subscription_id,
        UserAddon.purchase_date,
        UserAddon.expiry_date,
        UserAddon.is_active,
        UserAddon.auto_renew,
        UserAddon.status,
        UserAddon.zoho_addon_instance_id,
        UserAddon.remaining_count,
        UserAddon.initial_count
    ]

def init(app: FastAPI):
    admin = Admin(app=app, engine=engine, authentication_backend=authentication_backend)
    app.mount("/admin", admin)
    admin.add_view(UserAdmin)
    admin.add_view(BotAdmin)
    admin.add_view(FileAdmin)
    # admin.add_view(InteractionAdmin)
    admin.add_view(LanguageAdmin)
    # admin.add_view(PerformanceLogAdmin)
    # admin.add_view(RatingAdmin) 
    # admin.add_view(SubscriptionAdmin)
    admin.add_view(UserAuthProviderAdmin)
    admin.add_view(InteractionAdmin)
    admin.add_view(ChatMessageAdmin)
    admin.add_view(DemoRequestAdmin)
    admin.add_view(EmbeddingModelAdmin)
    admin.add_view(LLMModelAdmin)
    admin.add_view(SubscriptionPlanAdmin)
    admin.add_view(AddonAdmin)
    admin.add_view(UserSubscriptionAdmin)
    admin.add_view(TeamMemberAdmin)
    admin.add_view(InteractionReactionAdmin)
    admin.add_view(ScrapedNodeAdmin)
    admin.add_view(WebsiteDBAdmin)
    admin.add_view(YouTubeVideoAdmin)
    admin.add_view(NotificationAdmin)
    admin.add_view(ClusterAdmin)
    admin.add_view(ClusteredQuestionAdmin)
    admin.add_view(UserAddonAdmin) 
