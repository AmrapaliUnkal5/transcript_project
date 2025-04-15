from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session
from app.models import Cluster, ClusteredQuestion
import numpy as np
import hashlib
import re

class PGClusterer:
    def __init__(self):
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.embedding_model.encode(["warming up"])

    def normalize_text(self, text: str) -> str:
        return re.sub(r'\s+', ' ', text.strip().lower())

    def get_embedding(self, text: str) -> np.ndarray:
        return self.embedding_model.encode([text])[0]

    def cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

    def process_question(self, db: Session, bot_id: int, question_text: str) -> str:
        question_text = self.normalize_text(question_text)
        embedding = self.get_embedding(question_text)

        # ✅ Search all clusters for this bot
        clusters = db.query(Cluster).filter(Cluster.bot_id == bot_id).all()

        closest_cluster = None
        max_similarity = -1

        for cluster in clusters:
            centroid = np.array(cluster.centroid)
            similarity = self.cosine_similarity(embedding, centroid)
            print("Similarity=> ", similarity)
            if similarity > 0.80 and similarity > max_similarity:
                max_similarity = similarity
                closest_cluster = cluster

        if closest_cluster:
            # Update centroid and count
            n = closest_cluster.count
            new_centroid = ((np.array(closest_cluster.centroid) * n) + embedding) / (n + 1)
            closest_cluster.centroid = new_centroid.tolist()
            closest_cluster.count += 1
            db.add(closest_cluster)
            db.flush()
        else:
            # New cluster
            existing_numbers = db.query(Cluster.cluster_number).filter(Cluster.bot_id == bot_id).all()
            existing_numbers = [num[0] for num in existing_numbers]
            new_cluster_number = max(existing_numbers + [-1]) + 1
            closest_cluster = Cluster(
                bot_id=bot_id,
                cluster_number=new_cluster_number,
                centroid=embedding.tolist(),
                count=1
            )
            db.add(closest_cluster)
            db.flush()

        # Save the question
        clustered_q = ClusteredQuestion(
            cluster_id=closest_cluster.cluster_id,
            question_text=question_text,
            embedding=embedding.tolist()
        )
        db.add(clustered_q)
        db.commit()

        return f"{bot_id}-{closest_cluster.cluster_number}"

    def get_faqs(self, db: Session, bot_id: int, limit: int = 10):
        clusters = db.query(Cluster).filter(Cluster.bot_id == bot_id).order_by(Cluster.count.desc()).limit(limit).all()
        faqs = []
        for cluster in clusters:
            sample_qs = db.query(ClusteredQuestion.question_text)\
                .filter(ClusteredQuestion.cluster_id == cluster.cluster_id)\
                .limit(5).all()
            sample_qs = [q[0] for q in sample_qs]
            if sample_qs:
                faqs.append({
                    "question": sample_qs[0],
                    "similar_questions": sample_qs[1:],
                    "count": cluster.count,
                    "cluster_id": f"{bot_id}-{cluster.cluster_number}"
                })
        return faqs
